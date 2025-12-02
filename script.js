// famch v 0.8 (исправлены статусы сообщений)

/* ======================= ИНИЦИАЛИЗАЦИЯ FIREBASE ======================= */
firebase.initializeApp(window.firebaseConfig);	// Инициализация Firebase
const db = firebase.database(); 				// Получение доступа к Realtime Database
const auth = firebase.auth();					// Получение доступа к Firebase Auth


/* ======================= ПЕРЕМЕННЫЕ DOM ======================= */
const chatContainer = document.getElementById('chatContainer'); // Основной контейнер чата
const chat = document.getElementById('chat');                  // Контейнер сообщений
const msgInput = document.getElementById('message');           // Поле ввода текста
const fileInput = document.getElementById('fileInput');        // Поле для выбора файла
const pickImgBtn = document.getElementById('pickImgBtn');      // Кнопка "Выбрать фото"
const menuButton = document.getElementById('menuButton');      // Кнопка меню
const menuContent = document.getElementById('menuContent');    // Содержимое меню
const roomTitle = document.getElementById('roomTitle');        // Заголовок комнаты
const contactList = document.getElementById('contactList');    // Список контактов
const inputBox = document.getElementById('inputBox');          // Обёртка ввода сообщений
const loginDiv = document.getElementById('login');             // Блок логина
const loginBtn = document.getElementById('loginBtn');          // Кнопка входа
const registerBtn = document.getElementById('registerBtn');    // Кнопка регистрации
const loginError = document.getElementById('loginError');      // Поле для ошибок логина
const emailInput = document.getElementById('email');           // Поле email
const passInput = document.getElementById('password');         // Поле пароль
const avatarInput = document.getElementById('avatarInput');    // Поле выбора аватара
const chatListContainer = document.getElementById('chatListContainer'); // Контейнер списка чатов
const chatList = document.getElementById('chatList');          // UL списка чатов
const backButton = document.getElementById('backButton');      // Кнопка назад
const sendBtn = document.getElementById('sendBtn');            // Кнопка отправки сообщения
const lightboxOverlay = document.getElementById('lightboxOverlay'); // Лайтбокс для фото
const lightboxImg = lightboxOverlay.querySelector('img');     // Изображение в лайтбоксе

let selectedFileBase64 = null;      // Выбранный файл для отправки (Base64)
let currentRoom = "global";         // Текущая комната
let userAvatar = null;              // Аватар пользователя
let currentUserDisplayName = null;  // Имя пользователя для отображения
let messageListeners = {};          // Хранилище слушателей сообщений

// Разрешенные email для входа и отображаемые имена
const allowedEmails = {
  "rotastahm89@gmail.com": "Папа",
  "mom@example.com": "Мама",
  "child1@example.com": "Сын",
  "child2@example.com": "Дочь"
};

/* ======================= ИНИЦИАЛИЗАЦИЯ DOM И ВЫСОТА ЧАТА ======================= */
document.addEventListener('DOMContentLoaded', () => {
  function setVh() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }
  setVh();
  window.addEventListener('resize', setVh);
});

/* ======================= АВТАР ======================= */
avatarInput?.addEventListener('change', () => {
  const file = avatarInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { userAvatar = reader.result; };
  reader.readAsDataURL(file);
});

/* ======================= МЕНЮ ======================= */
document.addEventListener('DOMContentLoaded', () => { menuContent.style.display = 'none'; });
menuButton.addEventListener('click', () => {
  menuContent.style.display = menuContent.style.display === 'flex' ? 'none' : 'flex';
});

/* ======================= СПИСОК ЧАТОВ ======================= */
function renderChatList(currentUser) {
  chatList.innerHTML = '';

  const rooms = [
    { id: 'favorites_' + currentUser, name: 'Избранное', isPersonal: true },
    { id: 'global', name: 'Общая комната' }
  ];

  Object.entries(allowedEmails).forEach(([email, name]) => {
    if (name === currentUser) return;
    rooms.push({ id: getPrivateRoomId(currentUser, name), name: name, isPrivateChat: true });
  });

  const cachedChats = JSON.parse(localStorage.getItem('chatCache') || '{}');

  rooms.forEach(room => {
    const li = document.createElement('li');
    li.classList.add('chatListItem');
    if (room.isPersonal) li.classList.add('favoritesChat');

    const avatarContent = room.isPersonal ? '⭐' : room.name.charAt(0).toUpperCase();

    li.innerHTML = `
      <div class="chatListAvatar">${avatarContent}</div>
      <div class="chatListInfo">
        <div class="chatListRow">
          <span class="chatListName">${room.name}</span>
          ${room.isPrivateChat ? `<span id="status_${room.name}" class="user-status">офлайн</span>` : ''}
          <span class="chatListTime">${cachedChats[room.id]?.lastTime || ''}</span>
        </div>
        <span class="chatListLast">${cachedChats[room.id]?.lastMessage || 'Нет сообщений'}</span>
      </div>
    `;

    li.onclick = () => {
      document.querySelectorAll('.chatListItem').forEach(item => item.classList.remove('active'));
      li.classList.add('active');

      chatListContainer.style.display = 'none';
      chatContainer.style.display = 'flex';
      backButton.style.display = 'block';

      // Отключаем слушатели предыдущей комнаты
      if (messageListeners[currentRoom]) {
        db.ref('messages/' + currentRoom).off('child_added', messageListeners[currentRoom].added);
        db.ref('messages/' + currentRoom).off('child_changed', messageListeners[currentRoom].changed);
        db.ref('messages/' + currentRoom).off('child_removed', messageListeners[currentRoom].removed);
      }

      switchRoom(room.id, room.name, currentUser);
    };

    chatList.appendChild(li);

    // Подписка на последнее сообщение
    db.ref('messages/' + room.id).orderByChild('time').limitToLast(1).on('child_added', snapshot => {
      const msg = snapshot.val();
      const lastText = msg
        ? msg.text
          ? msg.text
          : msg.image
          ? (msg.selfDestruct ? '🕵️ Одноразовое фото' : '📷 Фото')
          : ''
        : 'Нет сообщений';

      const lastTime = msg ? new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

      li.querySelector('.chatListLast').textContent = lastText;
      li.querySelector('.chatListTime').textContent = lastTime;

      cachedChats[room.id] = { lastMessage: lastText, lastTime: lastTime };
      localStorage.setItem('chatCache', JSON.stringify(cachedChats));
    });

    if (room.isPrivateChat) { watchUserStatus(room.name); }
  });
}

/* ======================= ПОМОЩНИКИ ======================= */
function getPrivateRoomId(user1, user2) {
  return 'private_' + [user1, user2].sort().join('_');
}

/* ======================= НАЗАД ======================= */
backButton.addEventListener('click', () => {
  // Отключаем слушатели текущей комнаты
  if (messageListeners[currentRoom]) {
    db.ref('messages/' + currentRoom).off('child_added', messageListeners[currentRoom].added);
    db.ref('messages/' + currentRoom).off('child_changed', messageListeners[currentRoom].changed);
    db.ref('messages/' + currentRoom).off('child_removed', messageListeners[currentRoom].removed);
    delete messageListeners[currentRoom];
  }

  currentRoom = null;
  chatContainer.style.display = 'none';
  chatListContainer.style.display = 'block';
  backButton.style.display = 'none';
  chat.innerHTML = '';
  document.querySelectorAll('.chatListItem').forEach(item => item.classList.remove('active'));
});

/* ======================= ДОБАВЛЕНИЕ СООБЩЕНИЙ ======================= */
function addMessageToChat(message, key, currentUserDisplayName) {
  if (!message || !key) return;

  const msgDiv = document.createElement('div');
  msgDiv.classList.add('msg');
  msgDiv.dataset.key = key;

  const isSent = message.name === currentUserDisplayName;
  msgDiv.classList.add(isSent ? 'me' : 'other');

  const contentDiv = document.createElement('div');
  contentDiv.classList.add('msg-content');

  if (!isSent) {
    const nameSpan = document.createElement('span');
    nameSpan.classList.add('msg-name');
    nameSpan.textContent = message.name;
    contentDiv.appendChild(nameSpan);
  }

  if (message.replyTo) {
    const originalMsgDiv = document.querySelector(`div.msg[data-key='${message.replyTo}']`);
    if (originalMsgDiv) {
      let originalText = '';
      const originalP = originalMsgDiv.querySelector('.msg-content p');
      const originalImg = originalMsgDiv.querySelector('.chat-img');
      const originalAuthor = originalMsgDiv.querySelector('.msg-name')?.textContent || '';

      if (originalP && originalP.textContent.trim() !== '') originalText = originalP.textContent;
      else if (originalImg) originalText = '📷 Фото';

      if (originalText.length > 40) originalText = originalText.slice(0, 40) + '…';

      const replyBlock = document.createElement('div');
      replyBlock.classList.add('reply-quote-tg');
      replyBlock.innerHTML = `<span class="reply-author">${originalAuthor}:</span> <span class="reply-text">${originalText}</span>`;
      contentDiv.appendChild(replyBlock);
    }
  }

  if (message.text) {
    const textP = document.createElement('p');
    textP.textContent = message.text;

    if (message.selfDestruct) {
      textP.classList.add('self-destruct');
      textP.dataset.selfDestruct = "true";
    }

    contentDiv.appendChild(textP);
  } else if (message.image) {
    const img = document.createElement('img');
    img.src = message.image;
    img.classList.add('chat-img');

    if (message.selfDestruct) {
      img.classList.add('self-destruct');
      img.dataset.selfDestruct = "true";
    }

    img.onclick = () => {
      lightboxImg.src = img.src;
      lightboxOverlay.style.display = 'flex';

      const removeOnce = () => {
        if (message.selfDestruct && !isSent) {
          db.ref('messages/' + currentRoom + '/' + key).remove();
          msgDiv.remove();
        }
        lightboxOverlay.removeEventListener('click', removeOnce);
        lightboxImg.src = '';
        lightboxOverlay.style.display = 'none';
      };

      lightboxOverlay.addEventListener('click', removeOnce);
    };

    contentDiv.appendChild(img);
  }

  const timeSpan = document.createElement('span');
  timeSpan.classList.add('msg-time');
  timeSpan.textContent = new Date(message.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isSent) {
    const statusSpan = document.createElement('span');
    statusSpan.classList.add('msg-status');
    // Устанавливаем статус из сообщения или по умолчанию 'sent'
    statusSpan.textContent = formatStatus(message.status || 'sent');
    contentDiv.appendChild(statusSpan);
  }

  contentDiv.appendChild(timeSpan);
  msgDiv.appendChild(contentDiv);

  // Заменяем существующее сообщение или добавляем новое
  const existingMsg = document.querySelector(`.msg[data-key="${key}"]`);
  if (existingMsg) {
    existingMsg.replaceWith(msgDiv);
  } else {
    chat.appendChild(msgDiv);
  }

  // Прокрутка
  const isAtBottom = chat.scrollHeight - chat.clientHeight - chat.scrollTop <= 50;
  if (isAtBottom) setTimeout(() => { chat.scrollTop = chat.scrollHeight; }, 0);

  attachMessageMenu(msgDiv, { ...message, id: key });
}

/* ======================= СТАТУСЫ СООБЩЕНИЙ ======================= */
function formatStatus(status) { 
    if (status === 'sent') return '⏳';          // отправлено
    if (status === 'delivered') return '✓';     // доставлено
    if (status === 'read') return '✓✓';         // прочитано
    return ''; 
}

/*
  ГЛАВНЫЙ ФИКС ПРОБЛЕМЫ 1А:
  Слушаем ИЗМЕНЕНИЕ ЛЮБЫХ сообщений в комнате,
  но обновляем DOM ТОЛЬКО у сообщений, которые отправил текущий пользователь.
*/
function watchMessageStatusChanges(currentRoom, currentUserDisplayName) {

    db.ref('messages/' + currentRoom)
      .on('child_changed', snapshot => {

          const msg = snapshot.val();
          const key = snapshot.key;
          if (!msg || !msg.status) return;

          // обновляем кеш сообщений (чтобы при перезаходе всё было актуально)
          updateMessageInCache(currentRoom, key, { status: msg.status });

          // обновлять DOM нужно ТОЛЬКО для СВОИХ сообщений
          if (msg.name !== currentUserDisplayName) return;

          const msgDiv = document.querySelector(`.msg[data-key="${key}"]`);
          if (!msgDiv) return;

          let statusSpan = msgDiv.querySelector('.msg-status');

          // если у сообщения ещё нет span для статуса — создаём
          if (!statusSpan) {
              statusSpan = document.createElement('span');
              statusSpan.className = 'msg-status';
              msgDiv.appendChild(statusSpan);
          }

          // обновляем иконку статуса
          statusSpan.textContent = formatStatus(msg.status);
      });
}


/*
  Помечаем ВСЕ сообщения собеседника как прочитанные,
  если пользователь уже находится в чате.
*/
function markMessagesAsRead(currentRoom, currentUserDisplayName) {

    const timeWhenEntered = Date.now();

    db.ref('messages/' + currentRoom).once('value', snapshot => {
        const updates = {};

        snapshot.forEach(msgSnap => {
            const msg = msgSnap.val();
            const key = msgSnap.key;

            // условия, чтобы пометить как прочитанное:
            if (
                msg.name !== currentUserDisplayName &&          // сообщение другого пользователя
                msg.status !== 'read' &&                        // ещё не прочитано
                msg.time < timeWhenEntered                      // отправлено до входа в чат
            ) {
                updates[key] = { status: 'read' };
            }
        });

        // если есть что обновить
        Object.keys(updates).forEach(key => {
            db.ref('messages/' + currentRoom + '/' + key).update({ status: 'read' });
        });

    });
}


/* ======================= ОТПРАВКА СООБЩЕНИЙ ======================= */
function pushMessageToFirebase(message) {
  // Устанавливаем начальный статус
  message.status = 'sent';
  
  const msgRef = db.ref('messages/' + currentRoom).push(message);
  const key = msgRef.key;
  
  // Сразу обновляем статус на 'delivered' (сообщение записано в базу)
  // Небольшая задержка для имитации "доставки на сервер"
  setTimeout(() => {
    db.ref('messages/' + currentRoom + '/' + key).update({
      status: 'delivered'
    });
  }, 300);
  
  // Сохраняем в кеш сразу с ключом и статусом 'sent'
  // Позже статус обновится через child_changed
  if (!message.selfDestruct || !message.image) {
    let cachedMessages = JSON.parse(localStorage.getItem('messagesCache_' + currentRoom) || '[]');
    
    // Удаляем старые записи с тем же ключом
    cachedMessages = cachedMessages.filter(m => m.id !== key);
    
    cachedMessages.push({
      id: key,
      data: { ...message, id: key, status: 'sent' }
    });
    
    if (cachedMessages.length > 50) {
      cachedMessages = cachedMessages.slice(-50);
    }
    
    localStorage.setItem('messagesCache_' + currentRoom, JSON.stringify(cachedMessages));
  }
  
  return key;
}

/* ======================= РАБОТА С КЕШЕМ ======================= */
function removeMessageFromCache(roomId, messageId) {
  const cacheKey = 'messagesCache_' + roomId;
  let cachedMessages = JSON.parse(localStorage.getItem(cacheKey) || '[]');
  cachedMessages = cachedMessages.filter(msg => msg.id !== messageId);
  localStorage.setItem(cacheKey, JSON.stringify(cachedMessages));
}

function updateMessageInCache(roomId, messageId, updates) {
  const cacheKey = 'messagesCache_' + roomId;
  let cachedMessages = JSON.parse(localStorage.getItem(cacheKey) || '[]');
  const index = cachedMessages.findIndex(m => m.id === messageId);
  
  if (index !== -1) {
    cachedMessages[index].data = { ...cachedMessages[index].data, ...updates };
    localStorage.setItem(cacheKey, JSON.stringify(cachedMessages));
  }
}

/* ======================= ПЕРЕКЛЮЧЕНИЕ КОМНАТ ======================= */
function switchRoom(roomId, roomName, currentUser) {
  currentRoom = roomId;
  chat.innerHTML = '';
  roomTitle.textContent = roomName;

  const roomCacheKey = 'messagesCache_' + roomId;
  const cachedMessages = JSON.parse(localStorage.getItem(roomCacheKey) || '[]');

  // 1. Загружаем сообщения из кеша
  cachedMessages.forEach(m => {
    if (m && m.id && m.data) {
      addMessageToChat(m.data, m.id, currentUser);
    }
  });

  // 2. Отключаем старые слушатели (если есть)
  if (messageListeners[roomId]) {
    db.ref('messages/' + roomId).off('child_added', messageListeners[roomId].added);
    db.ref('messages/' + roomId).off('child_changed', messageListeners[roomId].changed);
    db.ref('messages/' + roomId).off('child_removed', messageListeners[roomId].removed);
  }

  // 3. Настраиваем слушатели для новой комнаты
  const listeners = {
    added: null,
    changed: null,
    removed: null
  };

  // Слушаем новые сообщения
  listeners.added = db.ref('messages/' + roomId).on('child_added', snapshot => {
    const msg = snapshot.val();
    const key = snapshot.key;

    if (document.querySelector(`.msg[data-key="${key}"]`)) return;

    addMessageToChat(msg, key, currentUser);

    // Сохраняем в кеш (кроме самоуничтожающихся)
    if (!msg.selfDestruct || !msg.image) {
      let updatedCache = JSON.parse(localStorage.getItem(roomCacheKey) || '[]');
      updatedCache = updatedCache.filter(m => m.id !== key);
      updatedCache.push({ id: key, data: msg });
      
      if (updatedCache.length > 50) {
        updatedCache = updatedCache.slice(-50);
      }
      
      localStorage.setItem(roomCacheKey, JSON.stringify(updatedCache));
    }
  });

  // Слушаем изменения сообщений (включая статусы)
  listeners.changed = db.ref('messages/' + roomId).on('child_changed', snapshot => {
    const msg = snapshot.val();
    const key = snapshot.key;
    
    // Обновляем в кеше
    updateMessageInCache(roomId, key, msg);
    
    // Обновляем в интерфейсе
    const msgDiv = document.querySelector(`.msg[data-key="${key}"]`);
    if (msgDiv) {
      if (msgDiv.classList.contains('me') && msg.status) {
        const statusSpan = msgDiv.querySelector('.msg-status');
        if (statusSpan) {
          statusSpan.textContent = formatStatus(msg.status);
        }
      }
    }
  });

  // Слушаем удаление сообщений
  listeners.removed = db.ref('messages/' + roomId).on('child_removed', snapshot => {
    const key = snapshot.key;
    const msgDiv = document.querySelector(`.msg[data-key="${key}"]`);
    if (msgDiv) msgDiv.remove();
    
    removeMessageFromCache(roomId, key);
  });

  // Сохраняем слушатели
  messageListeners[roomId] = listeners;

  // 4. Начинаем отслеживать статусы своих сообщений
  watchMessageStatusChanges(roomId, currentUser);

  // 5. Помечаем непрочитанные сообщения как прочитанные
  markMessagesAsRead(roomId, currentUser);
}

/* ======================= МЕНЮ ДЛЯ СООБЩЕНИЯ ======================= */
function attachMessageMenu(msgDiv, message) {
  const showMenuHandler = (event, isPC) => {
    msgDiv.classList.add('selected');
    showMessageMenu(msgDiv, message, isPC, event);
  };

  msgDiv.addEventListener('contextmenu', e => {
    e.preventDefault();
    showMenuHandler(e, true);
  });

  msgDiv.addEventListener('click', e => {
    if (window.innerWidth <= 768) {
      showMenuHandler(e, false);
    }
  });
}

function showMessageMenu(msgDiv, message, isPC, event) {
  document.querySelectorAll('.message-menu').forEach(m => m.remove());

  const menu = document.createElement('div');
  menu.classList.add('message-menu');

  const actions = ['Ответить', 'Копировать', 'Удалить', 'Очистить чат'];
  actions.forEach(action => {
    const btn = document.createElement('div');
    btn.textContent = action;
    btn.classList.add('message-menu-btn');

    btn.onclick = () => {
      if (action === 'Ответить') {
        const inputBoxDiv = document.getElementById('inputBox');
        let replyContainer = document.getElementById('replyContainer');
        if (!replyContainer) {
          replyContainer = document.createElement('div');
          replyContainer.id = 'replyContainer';
          replyContainer.classList.add('reply-container');
          inputBoxDiv.parentNode.insertBefore(replyContainer, inputBoxDiv);
        }

        let preview = replyContainer.querySelector('.reply-preview');
        if (!preview) {
          preview = document.createElement('div');
          preview.classList.add('reply-preview');
          replyContainer.appendChild(preview);
        }

        const author = message.name;
        const textPreview = message.text ? message.text.slice(0, 40) : message.image ? '📷 Фото' : '';
        preview.textContent = `${author}: ${textPreview}`;

        const cancelBtn = document.createElement('span');
        cancelBtn.textContent = ' ❌';
        cancelBtn.classList.add('reply-cancel');
        cancelBtn.onclick = () => {
          preview.remove();
          inputBoxDiv.dataset.replyTo = '';
        };
        preview.appendChild(cancelBtn);

        inputBoxDiv.dataset.replyTo = message.id;
      }

      if (action === 'Копировать' && message.text) navigator.clipboard.writeText(message.text);

      if (action === 'Удалить') {
        db.ref('messages/' + currentRoom + '/' + message.id).remove();
        let updatedCache = JSON.parse(localStorage.getItem('messagesCache_' + currentRoom) || '[]');
        updatedCache = updatedCache.filter(m => m.id !== message.id);
        localStorage.setItem('messagesCache_' + currentRoom, JSON.stringify(updatedCache));
        msgDiv.remove();
      }

      if (action === 'Очистить чат') {
        if (!currentRoom) return;
        const confirmClear = confirm('Вы уверены, что хотите удалить всю историю этого чата?');
        if (!confirmClear) return;

        db.ref('messages/' + currentRoom).remove()
          .then(() => {
            console.log('✅ История чата удалена из Firebase');
            localStorage.removeItem('messagesCache_' + currentRoom);
            chat.innerHTML = '';

            const li = document.querySelector(`.chatListItem.active`);
            if (li) {
              li.querySelector('.chatListLast').textContent = 'Нет сообщений';
              li.querySelector('.chatListTime').textContent = '';
            }

            alert('История чата успешно очищена!');
          })
          .catch(err => {
            console.error('❌ Ошибка при удалении истории чата:', err);
            alert('Не удалось очистить историю. Попробуйте ещё раз.');
          });
      }

      menu.remove();
      msgDiv.classList.remove('selected');
    };

    menu.appendChild(btn);
  });

  document.body.appendChild(menu);

  if (isPC) {
    menu.style.position = 'fixed';
    menu.style.top = `${event.clientY}px`;
    menu.style.left = `${event.clientX}px`;
  } else {
    menu.style.position = 'absolute';
    const rect = msgDiv.getBoundingClientRect();
    menu.style.top = `${rect.bottom + window.scrollY + 5}px`;
    menu.style.left = `${rect.left + window.scrollX}px`;
  }

  const closeMenu = e => {
    if (!menu.contains(e.target) && e.target !== msgDiv) {
      menu.remove();
      msgDiv.classList.remove('selected');
      document.removeEventListener('click', closeMenu);
    }
  };
  document.addEventListener('click', closeMenu);
}

/* ======================= ЛАЙТБОКС ======================= */
lightboxOverlay.addEventListener('click', () => {
  lightboxOverlay.style.display = 'none';
  lightboxImg.src = '';
});

/* ======================= ЗАПУСК ЧАТА ======================= */
function startChat(user) {
  const displayName = allowedEmails[user.email];

  sendBtn.addEventListener('click', () => {
    const text = msgInput.value.trim();
    const selfDestruct = document.getElementById('selfDestructCheck').checked;
    if (!text && !selectedFileBase64) return;

    const message = { name: displayName, time: Date.now(), selfDestruct };
    const replyToId = inputBox.dataset.replyTo;
    if (replyToId) message.replyTo = replyToId;

    if (text) {
      message.text = text;
      pushMessageToFirebase(message);
      msgInput.value = '';
      msgInput.style.height = 'auto';
    }
    if (selectedFileBase64) {
      message.image = selectedFileBase64;
      pushMessageToFirebase(message);
      selectedFileBase64 = null;
      document.getElementById('previewContainer').innerHTML = '';
      fileInput.value = '';
      document.getElementById('selfDestructCheck').checked = false;
    }

    const replyContainer = document.getElementById('replyContainer');
    if (replyContainer) replyContainer.remove();
    inputBox.dataset.replyTo = '';
  });

  pickImgBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      selectedFileBase64 = reader.result;
      document.getElementById('previewContainer').innerHTML = `<img src="${selectedFileBase64}">`;
    };
    reader.readAsDataURL(file);
  });
}

/* ======================= ОБНОВЛЕНИЕ FCM ТОКЕНА ======================= */
const updateFCMTokenWithOfficialPlugin = async (user) => {
  if (!user) return;

  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.FCM) {
    try {
      const { FCM } = window.Capacitor.Plugins;
      const { token } = await FCM.getToken();
      console.log("✅ Официальный плагин FCM получил токен:", token);

      await firebase.database().ref('users/' + user.uid + '/fcmToken').set(token);
      console.log("✅ Токен успешно сохранен в Realtime Database");
    } catch (err) {
      console.error("❌ Ошибка при работе с FCM:", err);
    }
  } else {
    console.warn("⚠️ Плагин FCM не найден (браузер или неподдерживаемое устройство)");
  }
};

/* ======================= ОНЛАЙН / ОФФЛАЙН ======================= */
function getLocalUidFromEmail(email) {
  if (!email) return null;
  return email.replace(/[@.]/g, "_");
}

function initUserStatus(user) {
  if (!user || !user.email) return;
  const uid = getLocalUidFromEmail(user.email);
  const userStatusRef = db.ref(`userStatus/${uid}`);

  userStatusRef.set({ online: true, lastSeen: Date.now() })
    .then(() => console.log('status: set online for', uid))
    .catch(err => console.error('status: set online error', err));

  userStatusRef.onDisconnect().set({ online: false, lastSeen: Date.now() });
}

function watchUserStatus(uidOrEmailLike) {
  if (!uidOrEmailLike) return;
  const uid = uidOrEmailLike.includes('@') ? getLocalUidFromEmail(uidOrEmailLike) : uidOrEmailLike;
  const ref = db.ref(`userStatus/${uid}`);

  ref.on('value', snap => {
    const data = snap.val() || {};
    updateUserStatusUI(uid, !!data.online, data.lastSeen);
  }, err => {
    console.error('watchUserStatus error', err);
  });
}

function updateUserStatusUI(uid, isOnline, lastSeen) {
  const byUid = document.getElementById('status_' + uid);
  if (byUid) {
    if (isOnline) {
      byUid.textContent = 'онлайн';
      byUid.classList.add('online');
    } else if (lastSeen) {
      byUid.textContent = 'был(а) в ' + new Date(lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      byUid.classList.remove('online');
    } else {
      byUid.textContent = 'офлайн';
      byUid.classList.remove('online');
    }
    return;
  }

  const byName = document.getElementById('status_' + uidToDisplayName(uid));
  if (byName) {
    if (isOnline) {
      byName.textContent = 'онлайн';
      byName.classList.add('online');
    } else if (lastSeen) {
      byName.textContent = 'был(а) в ' + new Date(lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      byName.classList.remove('online');
    } else {
      byName.textContent = 'офлайн';
      byName.classList.remove('online');
    }
  }
}

function uidToDisplayName(uid) {
  for (const email in allowedEmails) {
    if (getLocalUidFromEmail(email) === uid) return allowedEmails[email];
  }
  return uid;
}

function setUserOfflineNow(user) {
  if (!user || !user.email) return;
  const uid = getLocalUidFromEmail(user.email);
  const ref = db.ref(`userStatus/${uid}`);
  ref.set({ online: false, lastSeen: Date.now() })
    .then(() => console.log('status: set offline for', uid))
    .catch(err => console.error('status: set offline error', err));
}

/* ======================= АВТОРИЗАЦИЯ ======================= */
auth.onAuthStateChanged(user => {
  if (user) {
    const displayName = allowedEmails[user.email];
    if (!displayName) {
      alert("Доступ запрещён.");
      auth.signOut();
      return;
    }

    document.getElementById('login-wrapper').style.display = 'none';
    loginDiv.style.display = 'none';
    chatContainer.style.display = 'none';
    chatListContainer.style.display = 'block';
    menuBar.style.display = 'flex';
    inputBox.style.display = 'flex';
    backButton.style.display = 'none';

    renderChatList(displayName);
    startChat(user);

    console.log("Пользователь вошел, обновляем FCM токен...");
    updateFCMTokenWithOfficialPlugin(user);

    initUserStatus(user);

    Object.entries(allowedEmails).forEach(([email, name]) => {
      if (name !== displayName) {
        const uidLike = getLocalUidFromEmail(email);
        watchUserStatus(uidLike);
      }
    });

  } else {
    document.getElementById('login-wrapper').style.display = 'flex';
    loginDiv.style.display = 'block';
    chatContainer.style.display = 'none';
    chatListContainer.style.display = 'none';
    menuBar.style.display = 'none';
    inputBox.style.display = 'none';
    chat.innerHTML = '';
  }
});

/* ======================= ВХОД / РЕГИСТРАЦИЯ ======================= */
loginBtn.addEventListener('click', () => {
  loginError.textContent = '';
  const email = emailInput.value.trim();
  const pass = passInput.value.trim();
  auth.signInWithEmailAndPassword(email, pass)
    .catch(err => loginError.textContent = err.message);
});

registerBtn.addEventListener('click', () => {
  loginError.textContent = '';
  const email = emailInput.value.trim();
  const pass = passInput.value.trim();
  auth.createUserWithEmailAndPassword(email, pass)
    .catch(err => loginError.textContent = err.message);
});

/* ======================= ВЫХОД ======================= */
document.getElementById('logoutBtn').addEventListener('click', () => {
  if (auth.currentUser && auth.currentUser.email) {
    setUserOfflineNow(auth.currentUser);
  }
  auth.signOut();
});