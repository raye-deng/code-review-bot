# 🤖 Code Review Bot

Local AI-powered code review for JavaScript/TypeScript projects. Your code stays on your machine - no cloud LLMs.

## ✨ Features

- **Local-first** - All analysis runs on your machine with gpt-oss-20b
- **Privacy-focused** - Your code never leaves your local environment
- **Smart suggestions** - AI explains why issues occur and how to fix them
- **Batch processing** - Review entire codebases in minutes
- **Configurable rules** - Use your favorite ESLint configs (Airbnb, Standard, etc.)

## 🚀 Quick Start

```bash
# Clone and install
git clone https://github.com/your-username/code-review-bot.git
cd code-review-bot
npm install

# Review a single file
npx tsx src/index.ts path/to/file.ts

# Review a directory
npx tsx src/index.ts path/to/project
```

## 📋 Example Output

```
🔍 Reviewing code in: ./src

📄 src/utils.ts: 3 issues found

ERROR: no-undef
📍 src/utils.ts:3:3
💬 'console' is not defined.

Code:
  console.log('Calculating price...');

💡 Suggestion:
  Replace console.log with a proper logging utility or remove it. In production, console statements should be handled by a logging service that can control log levels and output destinations.
```

## 🔧 Configuration

Create a config file to customize rules:

```json
{
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": ["eslint:recommended"],
  "rules": {
    "no-console": "warn",
    "no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

## 🏗️ Architecture

- **ESLint** - Static analysis and rule checking
- **TypeScript AST** - Accurate code parsing
- **gpt-oss-20b** - Local LLM for natural language suggestions
- **Batch processing** - Efficient codebase reviews

## 📊 Validation Status

- ✅ Engine tested with TypeScript/JavaScript files
- ✅ Local model integration working
- ⏳ Production deployment pending
- ⏳ User feedback collection

## 🎯 MVP Roadmap (7 Days)

- [x] Day 1-2: Core engine + local model integration
- [ ] Day 3-4: Web UI + real-time review
- [ ] Day 5: User accounts + history
- [ ] Day 6: Testing & optimization
- [ ] Day 7: Launch on Product Hunt & IndieHackers

## 💰 Pricing (Planned)

- **Free**: 10 reviews/day, 500 line limit
- **Pro ($9/mo)**: Unlimited reviews, advanced rules, priority support

## 🤝 Contributing

Issues and PRs welcome! This is an MVP - expect rapid iteration.

## 📄 License

MIT - feel free to fork and use in your own projects.

---

Built with ❤️ for indie developers who care about privacy.
