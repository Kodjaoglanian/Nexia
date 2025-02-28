# BotZap Financeiro

Um assistente financeiro para WhatsApp que ajuda a gerenciar suas finanças pessoais, desenvolvido com a biblioteca [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js).

## Funcionalidades

- Interação por linguagem natural (entende frases comuns)
- Registro de receitas e despesas
- Transações recorrentes
- Consulta de saldo
- Relatórios financeiros
- Análises de gastos

## Requisitos

- Node.js 14+
- NPM ou Yarn
- Smartphone com WhatsApp instalado

## Instalação

1. Clone o repositório
2. Instale as dependências:

```bash
npm install
```

3. Inicie o bot:

```bash
npm start
```

4. Escaneie o QR code com seu WhatsApp para autenticar

## Exemplos de uso

O assistente entende linguagem natural. Você pode interagir com frases como:

- "Comprei pão na padaria por R$ 5,50"
- "Gastei 120 reais com conta de luz"
- "Recebi 2500 de salário"
- "Quanto tenho de saldo?"
- "Me mostre um relatório deste mês"

## Comandos tradicionais (alternativos)

Também aceita comandos com prefixo `/`:

- `/ajuda` - Mostrar lista de comandos
- `/receita [valor] [descrição]` - Registrar uma receita
- `/despesa [valor] [descrição]` - Registrar uma despesa
- `/recorrente [tipo] [valor] [descrição] [dia_do_mês]` - Registrar transação recorrente
- `/saldo` - Ver saldo atual
- `/relatorio [mes] [ano]` - Gerar relatório mensal
- `/grafico [tipo] [mes] [ano]` - Gerar gráfico (tipos: pizza, linha, barra)

## Armazenamento de dados

Os dados são armazenados em um banco SQLite local (finance.db).
