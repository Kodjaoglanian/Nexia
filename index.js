const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const db = require('./database');
const commands = require('./commands');
const nlp = require('./naturalLanguage');
const config = require('./config');

// Inicializar cliente do WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox']
    }
});

// Estados de autenticação para cada usuário
const authStates = {
    INITIAL: 'initial',            // Estado inicial
    LOGIN_REQUESTED: 'login',      // Bot pediu login, esperando resposta
    PASSWORD_REQUESTED: 'password',// Bot pediu senha, esperando resposta
    AUTHENTICATED: 'authenticated' // Usuário autenticado
};

// Armazenar estado de autenticação de cada usuário
const userAuthState = {};
// Armazenar dados temporários durante autenticação
const authTemp = {};

// Tornar os estados de autenticação acessíveis globalmente para que o comando de logout possa modificá-los
global.userAuthState = userAuthState;
global.authTemp = authTemp;

// Evento para gerar QR code
client.on('qr', (qr) => {
    console.log('QR Code recebido, escaneie-o com seu telefone:');
    qrcode.generate(qr, { small: true });
});

// Evento quando o cliente está pronto
client.on('ready', () => {
    console.log('Cliente conectado! O bot está online.');
    db.initDatabase();
});

const patterns = {
    // Padrão mais específico para comandos sem barra
    // Agora identifica apenas palavras únicas sem espaços como possíveis comandos
    command: /^[a-zA-Z]+$/
};

// Update the aliases to include new commands
commands.aliases = {
    ...commands.aliases,
    'comparar_meses': 'comparar',
    'comparativo': 'comparar',
    'compare': 'comparar',
    'média': 'media',
    'medias': 'media',
    'averages': 'media',
    'stats': 'media',
    'relatório_detalhado': 'relatorio',
    'relatório_filtrado': 'relatorio',
    'filtrar': 'relatorio'
};

// Lidar com mensagens
client.on('message', async (message) => {
    // Ignorar mensagens de grupos a menos que contenham a palavra-chave de autenticação
    const isGroup = message.from.endsWith('@g.us');
    const userPhone = message.from.split('@')[0];
    const messageText = message.body.trim().toLowerCase();
    
    // Log activity to help debugging
    console.log(`Processing message from user: ${userPhone}, content: "${message.body.substring(0, 30)}..."`);
    
    try {
        // Restrição por número de telefone
        if (config.restrictByPhoneNumber && !config.authorizedUsers.includes(userPhone)) {
            // Somente responde à palavra-chave, mesmo para números não autorizados
            if (messageText === config.authKeyword.toLowerCase()) {
                await client.sendMessage(message.from, 
                    '❌ Desculpe, este bot é privado e seu número não está autorizado a utilizá-lo.');
            }
            return;
        }

        // Verificar o estado de autenticação atual do usuário
        if (!userAuthState[userPhone]) {
            userAuthState[userPhone] = authStates.INITIAL;
        }
        
        // Palavra-chave de inicialização do bot
        if (messageText === config.authKeyword.toLowerCase()) {
            // Iniciar processo de autenticação
            userAuthState[userPhone] = authStates.LOGIN_REQUESTED;
            await client.sendMessage(message.from, '🔐 *Autenticação Necessária*\n\nPor favor, digite seu login:');
            return;
        }

        // Lidar com estados de autenticação
        switch (userAuthState[userPhone]) {
            case authStates.INITIAL:
                // No estado inicial, não responde a nada exceto a palavra-chave
                // (que foi tratada acima)
                return;
                
            case authStates.LOGIN_REQUESTED:
                // Usuário enviou o login
                authTemp[userPhone] = { login: messageText };
                userAuthState[userPhone] = authStates.PASSWORD_REQUESTED;
                await client.sendMessage(message.from, 'Digite sua senha:');
                return;
                
            case authStates.PASSWORD_REQUESTED:
                // Usuário enviou a senha, verificar credenciais
                const login = authTemp[userPhone]?.login;
                const password = messageText;
                
                if (db.verifyCredentials(login, password, config)) {
                    // Credenciais corretas
                    userAuthState[userPhone] = authStates.AUTHENTICATED;
                    await db.registerUserWithLogin(userPhone, message._data.notifyName || 'Usuário', login);
                    await db.authenticateUser(userPhone);
                    
                    // Limpar dados temporários
                    delete authTemp[userPhone];
                    
                    await client.sendMessage(message.from, config.welcomeMessage);
                    console.log(`Usuário autenticado: ${login} (${userPhone})`);
                } else {
                    // Credenciais inválidas
                    userAuthState[userPhone] = authStates.INITIAL;
                    await client.sendMessage(message.from, 
                        '❌ Login ou senha incorretos.\n\n' +
                        `Digite "${config.authKeyword}" para tentar novamente.`);
                }
                return;
                
            case authStates.AUTHENTICATED:
                // Usuário já autenticado, processar mensagem normalmente
                break;
        }
        
        // A partir daqui, apenas usuários autenticados podem continuar
        
        // Additional check for authenticated state
        if (userAuthState[userPhone] !== authStates.AUTHENTICATED) {
            console.log(`User ${userPhone} is not authenticated, state: ${userAuthState[userPhone]}`);
        }
        
        // Verificar se é um comando (com barra ou palavra única sem espaços)
        const isCommandWithSlash = message.body.startsWith('/');
        const isCommandWithoutSlash = patterns.command.test(message.body.trim());
        const isCommand = isCommandWithSlash || isCommandWithoutSlash;
        
        if (isCommand) {
            const text = message.body.trim();
            const commandText = text.startsWith('/') ? text.substring(1) : text;
            const spaceIndex = commandText.indexOf(' ');
            
            const command = spaceIndex > 0 ? commandText.substring(0, spaceIndex) : commandText;
            const params = spaceIndex > 0 ? commandText.substring(spaceIndex + 1) : '';
            
            await commands.processCommand(client, message, command, params);
            return;
        }
        
        // Se não é um comando específico, processar como linguagem natural
        await nlp.processMessage(client, message, userPhone);
        
    } catch (error) {
        console.error('Erro ao processar mensagem:', error);
        await client.sendMessage(message.from, 'Desculpe, ocorreu um erro ao processar sua mensagem.');
    }
});

// Inicializar cliente do WhatsApp
client.initialize();
