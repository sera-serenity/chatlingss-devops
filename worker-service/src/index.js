const mongoose = require('mongoose');
const { Worker } = require('bullmq');
const Redis = require('ioredis');
const File = require('./models/File');
const GameSession = require('./models/GameSession');
const Leaderboard  = require('./models/Leaderboard');
const Tournament = require('./models/Tournament');
require('dotenv').config();

// ─── Redis connection ────────────────────────────────────────────────────────
const connection = new Redis(process.env.REDIS_URL || 'redis://redis:6379', {
  maxRetriesPerRequest: null // required by BullMQ
});

// ─── MongoDB connection ──────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI || 'mongodb://mongo:27017/CuteChat')
  .then(() => console.log(JSON.stringify({
    service: 'worker-service', event: 'MONGO_CONNECTED', timestamp: new Date().toISOString()
  })))
  .catch(err => console.error('MongoDB connection error:', err));

// ════════════════════════════════════════════════════════════════════════════
// 🎮  GAME QUEUE WORKER
// ════════════════════════════════════════════════════════════════════════════
const gameWorker = new Worker('gameQueue', async (job) => {

  if (job.name === 'GAME_ENDED') {
    const { gameId, roomId, players = [], scores = {}, gameType } = job.data;

    console.log(JSON.stringify({
      service:   'worker-service',
      event:     'GAME_JOB_STARTED',
      gameId,
      attempt:   job.attemptsMade + 1,
      timestamp: new Date().toISOString()
    }));

    // 🎲 Simulate random 20% failure to demonstrate retry / resilience
    if (Math.random() < 0.2) {
      throw new Error(`Simulated transient failure for game ${gameId}`);
    }

    // ① Update GameSession → status: ended
    await GameSession.updateOne(
      { gameId },
      {
        $set: {
          status:      'ended',
          endedAt:     new Date(),
          finalScores: scores
        }
      }
    );

    // ② Update Leaderboard per player
    for (const player of players) {
      const score = scores[player.userId] || 0;
      await Leaderboard.updateOne(
        { userId: player.userId },
        {
          $inc: { totalGames: 1, totalScore: score },
          $setOnInsert: { username: player.username }
        },
        { upsert: true }
      );
    }

    // ③ Determine winner and increment wins
    const playerIds = Object.keys(scores);
    if (playerIds.length > 0) {
      const winnerId = playerIds.reduce((a, b) => scores[a] > scores[b] ? a : b);
      const winnerPlayer = players.find(p => p.userId === winnerId);
      if (winnerPlayer) {
        await Leaderboard.updateOne(
          { userId: winnerId },
          { $inc: { wins: 1 } }
        );
      }
    }

    // ④ Tournament aggregation (IMPORTANT)
    if (job.data.tournamentId) {
      const tournament = await Tournament.findOne({ tournamentId: job.data.tournamentId });
      if (tournament) {
        // Update cumulative scores
        for (const player of players) {
          const gameScore = scores[player.userId] || 0;
          tournament.cumulativeScores[player.userId] = (tournament.cumulativeScores[player.userId] || 0) + gameScore;
        }
        
        // Mark as modified for Mixed type
        tournament.markModified('cumulativeScores');
        
        tournament.currentGame += 1;
        const isFinished = tournament.currentGame > tournament.totalGames;
        
        if (isFinished) {
          tournament.status = 'ended';
          tournament.endedAt = new Date();
        }
        
        await tournament.save();

        // ⑤ Emit LIVE leaderboard update via Redis Pub/Sub
        await connection.publish('tournament_updates', JSON.stringify({
          tournamentId: tournament.tournamentId,
          roomId: tournament.roomId,
          event: isFinished ? 'TOURNAMENT_ENDED' : 'LEADERBOARD_UPDATED',
          cumulativeScores: tournament.cumulativeScores,
          currentGame: tournament.currentGame,
          totalGames: tournament.totalGames
        }));
      }
    }

    // ⑥ Structured DevOps log
    console.log(JSON.stringify({
      service:   'worker-service',
      event:     'GAME_PROCESSED',
      gameId,
      gameType,
      roomId,
      playerCount: players.length,
      scores,
      status:    'success',
      tournamentId: job.data.tournamentId || null,
      timestamp: new Date().toISOString()
    }));
  }

}, {
  connection,
  concurrency: 5
});

gameWorker.on('completed', job => {
  console.log(JSON.stringify({
    service: 'worker-service', event: 'JOB_COMPLETED',
    queue: 'gameQueue', jobId: job.id, jobName: job.name, timestamp: new Date().toISOString()
  }));
});

gameWorker.on('failed', (job, err) => {
  console.error(JSON.stringify({
    service: 'worker-service', event: 'JOB_FAILED',
    queue: 'gameQueue', jobId: job?.id, jobName: job?.name,
    error: err.message, attempt: job?.attemptsMade,
    timestamp: new Date().toISOString()
  }));
});

// ════════════════════════════════════════════════════════════════════════════
// 📂  FILE PROCESSING WORKER  (existing – preserved)
// ════════════════════════════════════════════════════════════════════════════
const fileWorker = new Worker('file-processing', async job => {
  const { fileId, fileUrl, fileType } = job.data;
  console.log(`[Worker] Started processing file: ${fileId}`);

  await File.findOneAndUpdate({ fileId }, { status: 'processing' });
  await new Promise(resolve => setTimeout(resolve, 2000));

  if (Math.random() < 0.2) {
    throw new Error('Random simulated processing failure');
  }

  await File.findOneAndUpdate({ fileId }, {
    status: 'processed',
    processedAt: new Date()
  });

  console.log(JSON.stringify({
    service: 'worker-service', event: 'FILE_PROCESSED',
    fileId, status: 'success', timestamp: new Date().toISOString()
  }));

}, { connection, concurrency: 5 });

fileWorker.on('completed', job => {
  console.log(`[Worker] File job completed: ${job.data.fileId}`);
});

fileWorker.on('failed', async (job, err) => {
  console.error(`[Worker] File job failed: ${job?.data?.fileId}`, err.message);
  if (!job) return;
  const file = await File.findOne({ fileId: job.data.fileId });
  if (file) {
    const newRetry = file.retryCount + 1;
    if (newRetry >= 3) {
      await File.findOneAndUpdate({ fileId: job.data.fileId }, { status: 'failed', retryCount: newRetry });
      console.log(JSON.stringify({
        service: 'worker-service', event: 'FILE_PROCESSING_FAILED',
        fileId: job.data.fileId, status: 'failed_permanently', timestamp: new Date().toISOString()
      }));
    } else {
      await File.findOneAndUpdate({ fileId: job.data.fileId }, { retryCount: newRetry });
    }
  }
});

console.log(JSON.stringify({
  service: 'worker-service', event: 'WORKER_STARTED',
  queues: ['gameQueue', 'file-processing'], timestamp: new Date().toISOString()
}));
