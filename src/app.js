import './styles.css';

document.addEventListener('DOMContentLoaded', () => {
  const COLUMN_IDS = ['todo', 'in-progress', 'done'];
  const COLUMN_TITLES = {
    todo: 'Todo',
    'in-progress': 'In Progress',
    done: 'Done'
  };

  let state = getState();
  let draggedCardId = null;
  let draggedColumnId = null;

  function getState() {
    const saved = localStorage.getItem('trello-state');
    if (!saved) {
      return COLUMN_IDS.map(id => ({
        id,
        title: COLUMN_TITLES[id],
        cards: []
      }));
    }
    try {
      return JSON.parse(saved);
    } catch (e) {
      return COLUMN_IDS.map(id => ({
        id,
        title: COLUMN_TITLES[id],
        cards: []
      }));
    }
  }

  function saveState() {
    localStorage.setItem('trello-state', JSON.stringify(state));
  }

  function getDropIndex(listEl, y) {
    const cards = Array.from(listEl.children).filter(c =>
      c.classList.contains('card') && !c.classList.contains('dragging')
    );
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      if (y < rect.top + rect.height / 2) return i;
    }
    return cards.length;
  }

  function render() {
    COLUMN_IDS.forEach(id => {
      const colEl = document.querySelector('.column[data-column-id="' + id + '"]');
      if (!colEl) return;

      const listEl = colEl.querySelector('.card-list');
      if (!listEl) return;

      listEl.innerHTML = '';

      const column = state.find(c => c.id === id);
      if (!column) return;

      column.cards.forEach(card => {
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        cardEl.draggable = true;
        cardEl.dataset.cardId = card.id;
        cardEl.dataset.columnId = id;

        cardEl.innerHTML =
          '<button type="button" class="card-delete">&times;</button>' +
          '<div class="card-content">' + card.content + '</div>';

        cardEl.querySelector('.card-delete').addEventListener('click', (e) => {
          e.stopPropagation();
          deleteCard(card.id, id);
        });

        cardEl.addEventListener('dragstart', (e) => {
          draggedCardId = card.id;
          draggedColumnId = id;
          cardEl.classList.add('dragging');
          document.body.classList.add('dragging-active');

          // КРИТИЧЕСКИ ВАЖНО: без этого Firefox отменит перетаскивание
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', card.id);
        });

        cardEl.addEventListener('dragend', () => {
          cardEl.classList.remove('dragging');
          document.body.classList.remove('dragging-active');
          const ph = document.querySelector('.placeholder');
          if (ph) ph.remove();
          draggedCardId = null;
          draggedColumnId = null;
        });

        listEl.appendChild(cardEl);
      });
    });
  }

  function addCardInput(columnId) {
    const colEl = document.querySelector('.column[data-column-id="' + columnId + '"]');
    if (!colEl) return;

    const listEl = colEl.querySelector('.card-list');
    const existingInput = listEl.querySelector('.card-input-wrapper');
    if (existingInput) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'card-input-wrapper';
    wrapper.innerHTML =
      '<textarea class="card-input" placeholder="Enter a title for this card..."></textarea>' +
      '<div class="card-input-actions">' +
      '<button type="button" class="btn-add">Add Card</button>' +
      '<button type="button" class="btn-cancel">&times;</button>' +
      '</div>';

    const textarea = wrapper.querySelector('.card-input');
    const btnAdd = wrapper.querySelector('.btn-add');
    const btnCancel = wrapper.querySelector('.btn-cancel');

    const addCard = () => {
      const content = textarea.value.trim();
      if (!content) return;

      const column = state.find(c => c.id === columnId);
      if (!column) return;

      column.cards.push({ id: Date.now().toString(), content });
      saveState();
      render();
    };

    const cancel = () => wrapper.remove();

    btnAdd.addEventListener('click', addCard);
    btnCancel.addEventListener('click', cancel);

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        addCard();
      }
      if (e.key === 'Escape') cancel();
    });

    listEl.appendChild(wrapper);
    textarea.focus();
  }

  function deleteCard(cardId, columnId) {
    const column = state.find(c => c.id === columnId);
    if (!column) return;

    column.cards = column.cards.filter(c => c.id !== cardId);
    saveState();
    render();
  }

  function getCardListFromEvent(e) {
  // Сначала ищем .card-list напрямую (когда курсор над карточкой)
  var cardList = e.target.closest('.card-list');
  if (cardList) return cardList;

  // Если не нашли — ищем колонку и берём её .card-list (когда курсор над пустой областью)
  var column = e.target.closest('.column');
  if (column) return column.querySelector('.card-list');

  return null;
  }

  document.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (!draggedCardId) return;

  const target = getCardListFromEvent(e);
  if (!target) return;

  e.dataTransfer.dropEffect = 'move';

  const oldPh = document.querySelector('.placeholder');
  if (oldPh) oldPh.remove();

  const ph = document.createElement('div');
  ph.className = 'placeholder';

  const dropIndex = getDropIndex(target, e.clientY);
  const cards = Array.from(target.children).filter(c =>
    c.classList.contains('card') && !c.classList.contains('dragging')
  );

  if (dropIndex >= cards.length) {
    target.appendChild(ph);
  } else {
    target.insertBefore(ph, cards[dropIndex]);
  }
});

document.addEventListener('drop', (e) => {
  e.preventDefault();
  if (!draggedCardId || !draggedColumnId) return;

  const targetList = getCardListFromEvent(e);
  if (!targetList) return;

  const targetColumnEl = targetList.closest('.column');
  if (!targetColumnEl) return;

  const targetColumnId = targetColumnEl.dataset.columnId;

  const fromCol = state.find(c => c.id === draggedColumnId);
  const toCol = state.find(c => c.id === targetColumnId);
  if (!fromCol || !toCol) return;

  const card = fromCol.cards.find(c => c.id === draggedCardId);
  if (!card) return;

  fromCol.cards = fromCol.cards.filter(c => c.id !== draggedCardId);

  const dropIndex = getDropIndex(targetList, e.clientY);
  toCol.cards.splice(dropIndex, 0, card);

  const ph = document.querySelector('.placeholder');
  if (ph) ph.remove();

  saveState();
  render();
});

  // Инициализация кнопок
  COLUMN_IDS.forEach(id => {
    const btn = document.querySelector('.column[data-column-id="' + id + '"] .add-card-btn');
    if (btn) {
      btn.addEventListener('click', () => addCardInput(id));
    } else {
      console.error('Кнопка для колонки ' + id + ' не найдена!');
    }
  });

  render();
});
