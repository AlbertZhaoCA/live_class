import { Server } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { db } from '@/db';
import { chatMessages, canvasData } from '@/db/schema';
import { nanoid } from 'nanoid';

let io: Server | null = null;

export function getIO(): Server | null {
  return io;
}

export function initSocketServer(httpServer: HTTPServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.onAny((eventName, ...args) => {
      console.log(`[Socket] Received event: ${eventName}`, args.length > 0 ? `with ${args.length} arguments` : '');
    });

    socket.on('join-session', ({ sessionId, userId, userName }) => {
      socket.join(sessionId);
      console.log(`[Socket] User ${userName} (${socket.id}) joined session ${sessionId}`);
      console.log(`[Socket] Session ${sessionId} now has ${io?.sockets.adapter.rooms.get(sessionId)?.size || 0} members`);

      socket.to(sessionId).emit('user-joined', {
        userId,
        userName,
        timestamp: new Date(),
      });
    });

    socket.on('leave-session', ({ sessionId, userId, userName }) => {
      socket.leave(sessionId);
      socket.to(sessionId).emit('user-left', {
        userId,
        userName,
        timestamp: new Date(),
      });
    });

    socket.on('send-message', async ({ sessionId, userId, userName, message }) => {
      try {
        const messageId = nanoid();
        const now = new Date();
        
        await db.insert(chatMessages).values({
          id: messageId,
          sessionId,
          userId,
          message,
          type: 'text',
          createdAt: now,
        });

        if (io) {
          io.to(sessionId).emit('new-message', {
            id: messageId,
            userId,
            userName,
            message,
            timestamp: now,
            type: 'text',
          });
        }
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('canvas-draw', ({ sessionId, userId, drawData }) => {
      socket.to(sessionId).emit('canvas-update', {
        userId,
        drawData,
        timestamp: new Date(),
      });
    });

    socket.on('canvas-save', async ({ sessionId, userId, canvasJson, pageNumber, whiteboardId }) => {
      try {
        const canvasId = nanoid();
        await db.insert(canvasData).values({
          id: canvasId,
          sessionId,
          userId,
          whiteboardId: whiteboardId || null,
          data: canvasJson,
          pageNumber: pageNumber || 1,
        });

        socket.emit('canvas-saved', { success: true });
      } catch (error) {
        console.error('Save canvas error:', error);
        socket.emit('error', { message: 'Failed to save canvas' });
      }
    });

    socket.on('canvas-clear', ({ sessionId }) => {
      if (io) {
        io.to(sessionId).emit('canvas-cleared');
      }
    });

    socket.on('raise-hand', ({ sessionId, userId, userName }) => {
      if (io) {
        io.to(sessionId).emit('hand-raised', {
          userId,
          userName,
          timestamp: new Date(),
        });
      }
    });

    socket.on('quiz-published', ({ sessionId, quizData }) => {
      if (io) {
        io.to(sessionId).emit('new-message', quizData);
      }
    });

    socket.on('whiteboard-started', ({ sessionId, whiteboardId }) => {
      if (io) {
        io.to(sessionId).emit('whiteboard-started', { whiteboardId });
      }
    });

    socket.on('whiteboard-draw', ({ sessionId, whiteboardId, action, data }) => {
      console.log('[Socket] Received whiteboard-draw:', { sessionId, whiteboardId, action, hasData: !!data });
      
      if (io) {
        const room = io.sockets.adapter.rooms.get(sessionId);
        const roomSize = room?.size || 0;
        const roomMembers = Array.from(room || []);
        
        console.log(`[Socket] Room ${sessionId} has ${roomSize} members:`, roomMembers);
        console.log(`[Socket] Broadcasting to ${roomSize - 1} other users (excluding sender ${socket.id})`);
        
        socket.to(sessionId).emit('whiteboard-update', {
          whiteboardId,
          action,
          data,
        });
        
        console.log('[Socket] Broadcasted whiteboard-update to session:', sessionId);
      }
    });

    socket.on('whiteboard-closed', ({ sessionId, whiteboardId }) => {
      if (io) {
        io.to(sessionId).emit('whiteboard-closed', { whiteboardId });
      }
    });

    socket.on('screen-sharing-started', ({ sessionId, userId, userName }) => {
      console.log(`[Socket] Screen sharing started by ${userName} in session ${sessionId}`);
      if (io) {
        io.to(sessionId).emit('screen-sharing-started', { userId, userName });
      }
    });

    socket.on('screen-sharing-stopped', ({ sessionId, userId, userName }) => {
      console.log(`[Socket] Screen sharing stopped by ${userName} in session ${sessionId}`);
      if (io) {
        io.to(sessionId).emit('screen-sharing-stopped', { userId, userName });
      }
    });

    socket.on('broadcast-screen-frame', ({ sessionId, imageData }) => {
      console.log(`[Socket] Broadcasting screen frame to session ${sessionId}, data size: ${imageData?.length || 0}`);
      if (io) {
        const room = io.sockets.adapter.rooms.get(sessionId);
        const roomSize = room?.size || 0;
        console.log(`[Socket] Room ${sessionId} has ${roomSize} members, broadcasting to ${roomSize - 1} others`);
        
        socket.to(sessionId).emit('screen-frame', { imageData });
        
        console.log(`[Socket] Screen frame broadcasted to session ${sessionId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
}
