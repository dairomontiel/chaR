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

    // --- Funciones auxiliares ---
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
        messagesDiv.scrollTop = messagesDiv.scrollHeight; // Scroll automático al último mensaje
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

    // --- Event Listeners ---

    registerBtn.addEventListener('click', async () => {
        const username = registerUsernameInput.value;
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
        const username = loginUsernameInput.value;
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
                messagesDiv.innerHTML = ''; // Limpiar mensajes antiguos

                // Conectar a Socket.io con el token
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
            socket.emit('chatMessage', message); // Emitir el evento 'chatMessage' al servidor
            displayMessage(message, 'sent', currentUser, new Date().toLocaleTimeString()); // Mostrarlo instantáneamente en el lado del remitente
            messageInput.value = '';
        }
    });

    logoutBtn.addEventListener('click', () => {
        if (socket) {
            socket.disconnect(); // Desconectar el socket
        }
        localStorage.removeItem('jwtToken');
        currentUser = '';
        showSection('auth');
        loginPasswordInput.value = ''; // Limpiar campo de contraseña al cerrar sesión
        loginMessage.textContent = '';
    });

    // --- Función para conectar el Socket ---
    function connectSocket(token) {
        // Asegúrate de que solo haya una conexión activa de socket.io
        if (socket && socket.connected) {
            socket.disconnect();
        }

        socket = io({
            auth: {
                token: token // Enviamos el token en la autenticación del handshake
            }
        });

        socket.on('connect', () => {
            console.log('Conectado al servidor de chat.');
            displayMessage('Te has conectado al chat.', 'system');
        });

        socket.on('disconnect', () => {
            console.log('Desconectado del servidor de chat.');
            // Puedes mostrar un mensaje al usuario aquí si lo deseas
        });

        socket.on('connect_error', (err) => {
            console.error('Error de conexión de Socket.io:', err.message);
            // Si el token es inválido, forzamos el logout
            if (err.message === 'Token inválido.' || err.message === 'No se proporcionó token de autenticación.') {
                alert('Tu sesión ha expirado o es inválida. Por favor, inicia sesión de nuevo.');
                logoutBtn.click(); // Forzar el cierre de sesión
            }
        });

        socket.on('chatMessage', (data) => {
            if (data.user === 'Sistema') {
                displayMessage(data.message, 'system', '', data.timestamp);
            } else if (data.user === currentUser) {
                // No mostrar nada, ya se mostró como 'sent'
                return;
            } else {
                displayMessage(data.message, 'received', data.user, data.timestamp);
            }
        });
    }

    // --- Cargar al inicio ---
    // Verificar si ya hay un token en el almacenamiento local al cargar la página
    const storedToken = localStorage.getItem('jwtToken');
    if (storedToken) {
        // Intentar reconectar si hay un token
        // NOTA: Esto intentará validar el token. Si expiró, el servidor rechazará la conexión.
        currentUsernameSpan.textContent = 'Cargando...'; // Placeholder
        // No sabemos el nombre de usuario de inmediato, el backend lo podría enviar o decodificarlo del token
        // Para este ejemplo simple, no estamos enviando el nombre de usuario de vuelta con el token,
        // pero en un caso real, el token decodificado podría tener el nombre de usuario.
        // O podríamos almacenarlo junto al token.
        // Por ahora, el usuario verá 'Cargando...' hasta que se conecte el socket y se obtenga el nombre de usuario (si se implementa).
        // Para un mejor UX, el nombre de usuario debería venir en el payload del JWT y ser almacenado también en el localStorage.
        // Por simplicidad, asumimos que el usuario que inició sesión es el mismo para fines de display.
        const decodedToken = jwt_decode(storedToken); // Necesitaríamos una librería para decodificar JWT en el frontend
        if (decodedToken && decodedToken.userId) {
            currentUser = decodedToken.userId;
            currentUsernameSpan.textContent = currentUser;
        } else {
             // Si el token no tiene userId o está corrupto, lo borramos
            localStorage.removeItem('jwtToken');
            showSection('auth');
            return;
        }

        connectSocket(storedToken);
        showSection('chat');
    } else {
        showSection('auth');
    }
});