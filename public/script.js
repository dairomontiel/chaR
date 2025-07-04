document.addEventListener('DOMContentLoaded', () => {
    const authSection = document.getElementById('auth-section');
    const chatSection = document.getElementById('chat-section');
    const currentUsernameSpan = document.getElementById('currentUsername');

    const registerUsernameInput = document.getElementById('registerUsername');
    const registerPasswordInput = document.getElementById('registerPassword');
    const registerBtn = document.getElementById('registerBtn');
    const registerMessage = document.getElementById('registerMessage');

    const loginUsernameInput = document.getElementById('loginUsername');
    const loginPasswordInput = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');
    const loginMessage = document.getElementById('loginMessage');

    const messagesDiv = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const messageForm = document.getElementById('messageForm');
    const logoutBtn = document.getElementById('logoutBtn');

    let socket;
    let currentUser = '';

    function showSection(sectionId) {
        if (sectionId === 'auth') {
            authSection.classList.remove('hidden');
            chatSection.classList.add('hidden');
        } else {
            authSection.classList.add('hidden');
            chatSection.classList.remove('hidden');
        }
    }

    function displayMessage(text, type = 'received', user = '', timestamp = '') {
        const messageItem = document.createElement('div');
        messageItem.classList.add('message-item', type);

        if (type === 'system') {
            messageItem.textContent = text;
        } else {
            messageItem.innerHTML = `<span class="user">${user}:</span> ${text} <span class="timestamp">${timestamp}</span>`;
        }
        messagesDiv.appendChild(messageItem);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function setAuthMessage(element, message, isSuccess) {
        element.textContent = message;
        element.className = 'message ' + (isSuccess ? 'success' : 'error');
    }

    function clearAuthMessages() {
        registerMessage.textContent = '';
        registerMessage.className = 'message';
        loginMessage.textContent = '';
        loginMessage.className = 'message';
    }

    registerBtn.addEventListener('click', async () => {
        const username = registerUsernameInput.value.trim().toLowerCase();
        const password = registerPasswordInput.value;
        clearAuthMessages();

        try {
            const response = await fetch('/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (response.ok) {
                setAuthMessage(registerMessage, data.message, true);
                registerUsernameInput.value = '';
                registerPasswordInput.value = '';
            } else {
                setAuthMessage(registerMessage, data.message, false);
            }
        } catch (error) {
            console.error('Error de red al registrar:', error);
            setAuthMessage(registerMessage, 'Error de conexión. Inténtalo de nuevo.', false);
        }
    });

    loginBtn.addEventListener('click', async () => {
        const username = loginUsernameInput.value.trim().toLowerCase();
        const password = loginPasswordInput.value;
        clearAuthMessages();

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (response.ok && data.token) {
                localStorage.setItem('jwtToken', data.token);
                currentUser = username;
                currentUsernameSpan.textContent = currentUser;
                setAuthMessage(loginMessage, 'Inicio de sesión exitoso.', true);
                messagesDiv.innerHTML = '';
                connectSocket(data.token);
                showSection('chat');
            } else {
                setAuthMessage(loginMessage, data.message || 'Error al iniciar sesión.', false);
            }
        } catch (error) {
            console.error('Error de red al iniciar sesión:', error);
            setAuthMessage(loginMessage, 'Error de conexión. Inténtalo de nuevo.', false);
        }
    });

    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = messageInput.value;
        if (message.trim() && socket) {
            socket.emit('chatMessage', message);
            displayMessage(message, 'sent', currentUser, new Date().toLocaleTimeString());
            messageInput.value = '';
        }
    });

    logoutBtn.addEventListener('click', () => {
        if (socket) {
            socket.disconnect();
        }
        localStorage.removeItem('jwtToken');
        currentUser = '';
        showSection('auth');
        loginPasswordInput.value = '';
        loginMessage.textContent = '';
    });

    function connectSocket(token) {
        if (socket && socket.connected) {
            socket.disconnect();
        }

        socket = io({
            auth: {
                token: token
            }
        });

        socket.on('connect', () => {
            console.log('Conectado al servidor de chat.');
            displayMessage('Te has conectado al chat.', 'system');
        });

        socket.on('disconnect', () => {
            console.log('Desconectado del servidor de chat.');
        });

        socket.on('connect_error', (err) => {
            console.error('Error de conexión de Socket.io:', err.message);
            if (err.message === 'Token inválido.' || err.message === 'No se proporcionó token de autenticación.') {
                alert('Tu sesión ha expirado o es inválida. Por favor, inicia sesión de nuevo.');
                logoutBtn.click();
            }
        });

        socket.on('chatMessage', (data) => {
            const sender = data.user.trim().toLowerCase();
            const localUser = currentUser.trim().toLowerCase();

            if (sender === 'sistema') {
                displayMessage(data.message, 'system', '', data.timestamp);
            } else if (sender === localUser) {
                return; // No mostrarlo, ya se mostró como "sent"
            } else {
                displayMessage(data.message, 'received', data.user, data.timestamp);
            }
        });
    }

    const storedToken = localStorage.getItem('jwtToken');
    if (storedToken) {
        try {
            const decodedToken = jwt_decode(storedToken);
            if (decodedToken && decodedToken.userId) {
                currentUser = decodedToken.userId.trim().toLowerCase();
                currentUsernameSpan.textContent = currentUser;
                connectSocket(storedToken);
                showSection('chat');
            } else {
                localStorage.removeItem('jwtToken');
                showSection('auth');
            }
        } catch (err) {
            console.error('Error al decodificar el token:', err);
            localStorage.removeItem('jwtToken');
            showSection('auth');
        }
    } else {
        showSection('auth');
    }
});
