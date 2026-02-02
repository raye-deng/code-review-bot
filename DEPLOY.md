# Code Review Bot - Deployment Guide

## Quick Deploy

### Vercel (Recommended)

1. Push code to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repository: `raye-deng/code-review-bot`
4. Deploy

### GitHub Pages

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build:
   ```bash
   npm run build
   ```

3. Deploy:
   ```bash
   npm run export
   ```

4. Push `out/` folder to `gh-pages` branch

## Environment Variables

None required - everything runs locally!

## Local Development

```bash
npm run dev
```

Visit http://localhost:3000

## API Testing

```bash
curl -X POST http://localhost:3000/api/review \
  -H "Content-Type: application/json" \
  -d '{"code":"const x = 1;\nconsole.log(x);","language":"typescript"}'
```

## Troubleshooting

**Next.js build fails:**
- Ensure Node.js >= 18
- Clear `.next` folder: `rm -rf .next`

**Local LLM connection error:**
- Check `http://192.168.66.141:12004/v1` is accessible
- Verify LMStudio is running

**ESLint errors:**
- Update `eslint.config.mjs` with your preferred rules
