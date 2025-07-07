// users.js
const bcrypt = require('bcrypt'); // Asegúrate de tener bcrypt instalado: npm install bcrypt

async function hashPasswords() {
    const defaultPassword = '123456'; // Contraseña de ejemplo para hashing
    const hashedPassword1 = await bcrypt.hash(defaultPassword, 10);
    const hashedPassword2 = await bcrypt.hash(defaultPassword, 10);

    return [
        { id: 1, username: 'Marina', password: hashedPassword1 },
        { id: 2, username: 'Dairo', password: hashedPassword2 }
    ];
}

// Exportar la promesa para que el servidor la espere
module.exports = hashPasswords();