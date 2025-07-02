const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
console.log('🟢 server.js started executing...');


// 💬 Commentary generator
function generateCommentary(move, evaluation) {
  let message = `I'll play ${move}. `;

  const score = parseFloat(evaluation);
  if (!isNaN(score)) {
    if (score > 1) message += "I'm gaining an advantage!";
    else if (score < -1) message += "You're doing great, I need to defend.";
    else message += "It's a balanced game so far.";
  } else {
    message += "Let's see how you respond.";
  }

  return message;
}

app.get('/', (req, res) => {
  res.send('🧠 Stockfish backend is alive!');
});

app.post('/bestmove', (req, res) => {
  const { fen } = req.body;
  if (!fen) return res.status(400).json({ error: 'FEN is required' });

  console.log('📥 Received FEN:', fen);

  const enginePath = path.join(__dirname, 'stockfish', 'stockfish-windows-x86-64-avx2.exe');
  const engine = spawn(enginePath);

  let outputBuffer = '';
  let evaluation = '0'; // default if not found

  engine.stdin.write('uci\n');
  engine.stdin.write(`position fen ${fen}\n`);
  engine.stdin.write('go depth 12\n');

  engine.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('📤 Stockfish says:', output);
    outputBuffer += output;

    // 🔎 Extract evaluation score
    const evalMatch = output.match(/score cp (-?\d+)/);
    if (evalMatch && evalMatch[1]) {
      evaluation = (parseInt(evalMatch[1]) / 100).toFixed(2); // convert centipawn to normal score
    }

    if (output.includes('bestmove')) {
      const match = output.match(/bestmove (\S+)/);
      if (match && match[1]) {
        const bestMove = match[1];
        console.log('✅ Best move:', bestMove);

        const commentary = generateCommentary(bestMove, evaluation);

        res.json({
          bestMove,
          evaluation,
          commentary
        });
      } else {
        res.status(500).json({ error: 'Best move not found in output' });
      }
      engine.kill();
    }
  });

  engine.stderr.on('data', (err) => {
    console.error('🚨 Stockfish error:', err.toString());
  });

  engine.on('error', (err) => {
    console.error('🔥 Engine spawn failed:', err.toString());
    res.status(500).json({ error: 'Engine failed to start' });
  });

  setTimeout(() => {
    if (!res.headersSent) {
      console.error('⏳ Stockfish timed out.');
      res.status(500).json({ error: 'Timeout' });
      engine.kill();
    }
  }, 5000);
});

app.listen(PORT, () => {
  console.log(`🚀 Stockfish server running at http://localhost:${PORT}`);

});


