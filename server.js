// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io'); // Importación correcta para Socket.io 3+
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt'); // Necesitamos bcrypt para el login
const cors = require('cors');

// Importar el middleware de autenticación del socket
const verifyToken = require('./authMiddleware');
// Importar y esperar que los usuarios se carguen (con contraseñas hasheadas)
let users = [];
require('./users').then(loadedUsers => {
    users = loadedUsers;
    console.log('Usuarios cargados y hasheados.');
}).catch(error => {
    console.error('Error al cargar usuarios:', error);
});


const app = express();
const server = http.createServer(app);
const io = new Server(server, { // Inicialización correcta de Socket.io 3+
    cors: {
        origin: "*", // Permite conexiones desde cualquier origen para desarrollo
        methods: ["GET", "POST"]
    }
});

const secretKey = 'secreto123'; // ¡Misma clave secreta que en authMiddleware.js!

// Middlewares
app.use(cors());
app.use(express.json()); // Preferible a bodyParser.json()
app.use(express.static('public')); // Servir archivos estáticos desde la carpeta 'public'

// --- Rutas HTTP (Login y Registro) ---

// Registro de usuario (Añadido para tener un flujo completo)
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Nombre de usuario y contraseña son requeridos.' });
    }

    if (users.find(user => user.username === username)) {
        return res.status(409).json({ message: 'Este nombre de usuario ya está registrado.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        // Genera un ID simple para el usuario (en una DB sería automático)
        const newUserId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
        users.push({ id: newUserId, username, password: hashedPassword });
        console.log(`Nuevo usuario registrado: ${username}`);
        res.status(201).json({ message: 'Usuario registrado exitosamente.' });
    } catch (error) {
        console.error('Error al registrar usuario:', error);
        res.status(500).json({ message: 'Error al registrar el usuario.' });
    }
});


// Login
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);

    if (!user) {
        return res.status(401).json({ error: "Credenciales inválidas" });
    }

    try {
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (passwordMatch) {
            const token = jwt.sign({ id: user.id, username: user.username }, secretKey, {
                expiresIn: "1h"
            });
            res.json({ token });
        } else {
            res.status(401).json({ error: "Credenciales inválidas" });
        }
    } catch (error) {
        console.error('Error durante el login:', error);
        res.status(500).json({ message: 'Error al iniciar sesión.' });
    }
});

// --- Socket.io Autenticado ---
io.use(verifyToken); // Aplica el middleware de verificación JWT a las conexiones de Socket.io

io.on("connection", (socket) => {
    // socket.user contendrá { id, username } gracias a verifyToken
    console.log(`Usuario conectado: ${socket.user.username} (ID: ${socket.user.id})`);

    // Unirse a una sala de chat por defecto
    const defaultRoom = 'general_chat';
    socket.join(defaultRoom);
    console.log(`${socket.user.username} se ha unido a la sala '${defaultRoom}'`);

    // Notificar a todos los demás en la sala que un nuevo usuario se ha unido
    socket.to(defaultRoom).emit('chatMessage', {
        user: 'Sistema',
        message: `${socket.user.username} se ha unido al chat.`,
        timestamp: new Date().toLocaleTimeString()
    });

    // Escuchar el evento 'chatMessage' enviado por el cliente
    socket.on('chatMessage', (msg) => {
        const messageData = {
            user: socket.user.username, // Nombre de usuario del token JWT
            message: msg,
            timestamp: new Date().toLocaleTimeString()
        };
        console.log(`Mensaje de ${messageData.user}: ${messageData.message}`);

        // Emitir el mensaje a todos los clientes en la sala
        io.to(defaultRoom).emit('chatMessage', messageData);
    });

    socket.on("disconnect", () => {
        console.log(`Usuario desconectado: ${socket.user.username}`);
        // Notificar a todos los demás que un usuario se ha desconectado
        socket.to(defaultRoom).emit('chatMessage', {
            user: 'Sistema',
            message: `${socket.user.username} se ha desconectado del chat.`,
            timestamp: new Date().toLocaleTimeString()
        });
    });
});

// Inicio del servidor
const port = 3000;
server.listen(port, () => console.log(`Servidor escuchando en http://localhost:${port}`));