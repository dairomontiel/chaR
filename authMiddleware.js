// authMiddleware.js
const jwt = require('jsonwebtoken');
const secretKey = 'secreto123'; // ¡Debe ser la misma clave que usas para firmar en server.js!

const verifyToken = (socket, next) => {
    // El token se espera en socket.handshake.auth.token
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error('No se proporcionó token de autenticación.'));
    }

    jwt.verify(token, secretKey, (err, decoded) => {
        if (err) {
            // Un token puede ser inválido por expiración, firma incorrecta, etc.
            return next(new Error('Token inválido o expirado.'));
        }
        // Si el token es válido, adjuntamos la información decodificada al objeto socket
        // Usamos 'user' para ser consistente con socket.user.username en el resto del código
        socket.user = decoded;
        next();
    });
};

module.exports = verifyToken;
