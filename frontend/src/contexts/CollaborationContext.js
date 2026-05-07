import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const CollaborationContext = createContext();

export const useCollaboration = () => {
  const context = useContext(CollaborationContext);
  if (!context) {
    throw new Error('useCollaboration must be used within a CollaborationProvider');
  }
  return context;
};

export const CollaborationProvider = ({ children }) => {
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();

  // Collaboration state
  const [activeUsers, setActiveUsers] = useState([]);
  const [userCursors, setUserCursors] = useState({});
  const [userSelections, setUserSelections] = useState({});
  const [sharedDocuments, setSharedDocuments] = useState([]);
  const [collaborativeEdits, setCollaborativeEdits] = useState([]);
  const [roomId, setRoomId] = useState(null);
  const [isCollaborating, setIsCollaborating] = useState(false);

  // Real-time editing state
  const [documentContent, setDocumentContent] = useState('');
  const [pendingChanges, setPendingChanges] = useState([]);
  const [lastSyncTime, setLastSyncTime] = useState(Date.now());
  const [conflictResolution, setConflictResolution] = useState('auto');

  // Voice/Video collaboration
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [mediaStream, setMediaStream] = useState(null);

  // Comments and annotations
  const [comments, setComments] = useState([]);
  const [annotations, setAnnotations] = useState([]);
  const [activeComment, setActiveComment] = useState(null);

  // Presence awareness
  const [userPresence, setUserPresence] = useState({});
  const [typingUsers, setTypingUsers] = useState([]);
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Join collaboration room
  const joinRoom = useCallback(async (documentId, roomType = 'document') => {
    if (!socket || !isConnected || !user) return;

    const newRoomId = `${roomType}-${documentId}`;
    
    try {
      socket.emit('join-collaboration-room', {
        roomId: newRoomId,
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        userRole: user.role,
        timestamp: Date.now()
      });

      setRoomId(newRoomId);
      setIsCollaborating(true);
      
      return newRoomId;
    } catch (error) {
      console.error('Failed to join collaboration room:', error);
      throw error;
    }
  }, [socket, isConnected, user]);

  // Leave collaboration room
  const leaveRoom = useCallback(() => {
    if (!socket || !roomId) return;

    socket.emit('leave-collaboration-room', {
      roomId,
      userId: user?.id,
      timestamp: Date.now()
    });

    setRoomId(null);
    setIsCollaborating(false);
    setActiveUsers([]);
    setUserCursors({});
    setUserSelections({});
  }, [socket, roomId, user]);

  // Send cursor position
  const updateCursor = useCallback((position) => {
    if (!socket || !roomId || !isCollaborating) return;

    socket.emit('cursor-update', {
      roomId,
      userId: user?.id,
      position,
      timestamp: Date.now()
    });
  }, [socket, roomId, isCollaborating, user]);

  // Send selection update
  const updateSelection = useCallback((selection) => {
    if (!socket || !roomId || !isCollaborating) return;

    socket.emit('selection-update', {
      roomId,
      userId: user?.id,
      selection,
      timestamp: Date.now()
    });
  }, [socket, roomId, isCollaborating, user]);

  // Send document edit
  const sendEdit = useCallback((edit) => {
    if (!socket || !roomId || !isCollaborating) return;

    const editData = {
      id: `edit-${Date.now()}-${Math.random()}`,
      roomId,
      userId: user?.id,
      userName: `${user?.firstName} ${user?.lastName}`,
      edit,
      timestamp: Date.now()
    };

    socket.emit('document-edit', editData);
    
    // Add to pending changes
    setPendingChanges(prev => [...prev, editData]);
  }, [socket, roomId, isCollaborating, user]);

  // Apply collaborative edit
  const applyEdit = useCallback((editData) => {
    setCollaborativeEdits(prev => [...prev, editData]);
    
    // Apply edit to document content
    if (editData.edit.type === 'insert') {
      setDocumentContent(prev => {
        const { position, content } = editData.edit;
        return prev.slice(0, position) + content + prev.slice(position);
      });
    } else if (editData.edit.type === 'delete') {
      setDocumentContent(prev => {
        const { position, length } = editData.edit;
        return prev.slice(0, position) + prev.slice(position + length);
      });
    } else if (editData.edit.type === 'replace') {
      setDocumentContent(prev => {
        const { position, length, content } = editData.edit;
        return prev.slice(0, position) + content + prev.slice(position + length);
      });
    }
  }, []);

  // Add comment
  const addComment = useCallback((comment) => {
    if (!socket || !roomId || !isCollaborating) return;

    const commentData = {
      id: `comment-${Date.now()}`,
      roomId,
      userId: user?.id,
      userName: `${user?.firstName} ${user?.lastName}`,
      userAvatar: user?.avatar,
      content: comment.content,
      position: comment.position,
      resolved: false,
      timestamp: Date.now()
    };

    socket.emit('add-comment', commentData);
    setComments(prev => [...prev, commentData]);
  }, [socket, roomId, isCollaborating, user]);

  // Resolve comment
  const resolveComment = useCallback((commentId) => {
    if (!socket || !roomId || !isCollaborating) return;

    socket.emit('resolve-comment', {
      roomId,
      commentId,
      userId: user?.id,
      timestamp: Date.now()
    });

    setComments(prev => 
      prev.map(comment => 
        comment.id === commentId 
          ? { ...comment, resolved: true, resolvedBy: user?.id, resolvedAt: Date.now() }
          : comment
      )
    );
  }, [socket, roomId, isCollaborating, user]);

  // Add annotation
  const addAnnotation = useCallback((annotation) => {
    if (!socket || !roomId || !isCollaborating) return;

    const annotationData = {
      id: `annotation-${Date.now()}`,
      roomId,
      userId: user?.id,
      userName: `${user?.firstName} ${user?.lastName}`,
      type: annotation.type, // highlight, underline, strikethrough, etc.
      position: annotation.position,
      style: annotation.style,
      timestamp: Date.now()
    };

    socket.emit('add-annotation', annotationData);
    setAnnotations(prev => [...prev, annotationData]);
  }, [socket, roomId, isCollaborating, user]);

  // Start typing indicator
  const startTyping = useCallback(() => {
    if (!socket || !roomId || !isCollaborating) return;

    socket.emit('typing-start', {
      roomId,
      userId: user?.id,
      userName: `${user?.firstName} ${user?.lastName}`,
      timestamp: Date.now()
    });
  }, [socket, roomId, isCollaborating, user]);

  // Stop typing indicator
  const stopTyping = useCallback(() => {
    if (!socket || !roomId || !isCollaborating) return;

    socket.emit('typing-stop', {
      roomId,
      userId: user?.id,
      timestamp: Date.now()
    });
  }, [socket, roomId, isCollaborating, user]);

  // Voice/Video controls
  const toggleVoice = useCallback(async () => {
    try {
      if (!voiceEnabled) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMediaStream(stream);
        setVoiceEnabled(true);
        
        if (socket && roomId) {
          socket.emit('voice-enabled', { roomId, userId: user?.id });
        }
      } else {
        if (mediaStream) {
          mediaStream.getAudioTracks().forEach(track => track.stop());
        }
        setVoiceEnabled(false);
        
        if (socket && roomId) {
          socket.emit('voice-disabled', { roomId, userId: user?.id });
        }
      }
    } catch (error) {
      console.error('Failed to toggle voice:', error);
    }
  }, [voiceEnabled, mediaStream, socket, roomId, user]);

  const toggleVideo = useCallback(async () => {
    try {
      if (!videoEnabled) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: voiceEnabled });
        setMediaStream(stream);
        setVideoEnabled(true);
        
        if (socket && roomId) {
          socket.emit('video-enabled', { roomId, userId: user?.id });
        }
      } else {
        if (mediaStream) {
          mediaStream.getVideoTracks().forEach(track => track.stop());
        }
        setVideoEnabled(false);
        
        if (socket && roomId) {
          socket.emit('video-disabled', { roomId, userId: user?.id });
        }
      }
    } catch (error) {
      console.error('Failed to toggle video:', error);
    }
  }, [videoEnabled, mediaStream, voiceEnabled, socket, roomId, user]);

  const toggleScreenShare = useCallback(async () => {
    try {
      if (!screenSharing) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setMediaStream(stream);
        setScreenSharing(true);
        
        if (socket && roomId) {
          socket.emit('screen-share-start', { roomId, userId: user?.id });
        }
      } else {
        if (mediaStream) {
          mediaStream.getVideoTracks().forEach(track => track.stop());
        }
        setScreenSharing(false);
        
        if (socket && roomId) {
          socket.emit('screen-share-stop', { roomId, userId: user?.id });
        }
      }
    } catch (error) {
      console.error('Failed to toggle screen share:', error);
    }
  }, [screenSharing, mediaStream, socket, roomId, user]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    // User presence events
    socket.on('user-joined-room', (userData) => {
      setActiveUsers(prev => {
        const filtered = prev.filter(u => u.id !== userData.userId);
        return [...filtered, {
          id: userData.userId,
          name: userData.userName,
          role: userData.userRole,
          joinedAt: userData.timestamp,
          isActive: true
        }];
      });
    });

    socket.on('user-left-room', (userData) => {
      setActiveUsers(prev => prev.filter(u => u.id !== userData.userId));
      setUserCursors(prev => {
        const newCursors = { ...prev };
        delete newCursors[userData.userId];
        return newCursors;
      });
      setUserSelections(prev => {
        const newSelections = { ...prev };
        delete newSelections[userData.userId];
        return newSelections;
      });
    });

    // Cursor and selection events
    socket.on('cursor-updated', ({ userId, position }) => {
      if (userId !== user?.id) {
        setUserCursors(prev => ({
          ...prev,
          [userId]: position
        }));
      }
    });

    socket.on('selection-updated', ({ userId, selection }) => {
      if (userId !== user?.id) {
        setUserSelections(prev => ({
          ...prev,
          [userId]: selection
        }));
      }
    });

    // Document editing events
    socket.on('document-edited', (editData) => {
      if (editData.userId !== user?.id) {
        applyEdit(editData);
      }
    });

    // Comment events
    socket.on('comment-added', (commentData) => {
      if (commentData.userId !== user?.id) {
        setComments(prev => [...prev, commentData]);
      }
    });

    socket.on('comment-resolved', ({ commentId, userId: resolverId, timestamp }) => {
      setComments(prev => 
        prev.map(comment => 
          comment.id === commentId 
            ? { ...comment, resolved: true, resolvedBy: resolverId, resolvedAt: timestamp }
            : comment
        )
      );
    });

    // Annotation events
    socket.on('annotation-added', (annotationData) => {
      if (annotationData.userId !== user?.id) {
        setAnnotations(prev => [...prev, annotationData]);
      }
    });

    // Typing events
    socket.on('user-typing', ({ userId, userName }) => {
      if (userId !== user?.id) {
        setTypingUsers(prev => {
          const filtered = prev.filter(u => u.id !== userId);
          return [...filtered, { id: userId, name: userName }];
        });
      }
    });

    socket.on('user-stopped-typing', ({ userId }) => {
      setTypingUsers(prev => prev.filter(u => u.id !== userId));
    });

    // Voice/Video events
    socket.on('user-voice-enabled', ({ userId }) => {
      setUserPresence(prev => ({
        ...prev,
        [userId]: { ...prev[userId], voiceEnabled: true }
      }));
    });

    socket.on('user-voice-disabled', ({ userId }) => {
      setUserPresence(prev => ({
        ...prev,
        [userId]: { ...prev[userId], voiceEnabled: false }
      }));
    });

    socket.on('user-video-enabled', ({ userId }) => {
      setUserPresence(prev => ({
        ...prev,
        [userId]: { ...prev[userId], videoEnabled: true }
      }));
    });

    socket.on('user-video-disabled', ({ userId }) => {
      setUserPresence(prev => ({
        ...prev,
        [userId]: { ...prev[userId], videoEnabled: false }
      }));
    });

    return () => {
      socket.off('user-joined-room');
      socket.off('user-left-room');
      socket.off('cursor-updated');
      socket.off('selection-updated');
      socket.off('document-edited');
      socket.off('comment-added');
      socket.off('comment-resolved');
      socket.off('annotation-added');
      socket.off('user-typing');
      socket.off('user-stopped-typing');
      socket.off('user-voice-enabled');
      socket.off('user-voice-disabled');
      socket.off('user-video-enabled');
      socket.off('user-video-disabled');
    };
  }, [socket, isConnected, user, applyEdit]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
      leaveRoom();
    };
  }, [mediaStream, leaveRoom]);

  // Auto-sync pending changes
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (pendingChanges.length > 0) {
        // Clear pending changes after sync
        setPendingChanges([]);
        setLastSyncTime(Date.now());
      }
    }, 1000);

    return () => clearInterval(syncInterval);
  }, [pendingChanges]);

  const value = {
    // Room management
    roomId,
    isCollaborating,
    joinRoom,
    leaveRoom,

    // Users and presence
    activeUsers,
    userPresence,
    typingUsers,
    lastActivity,

    // Cursor and selection
    userCursors,
    userSelections,
    updateCursor,
    updateSelection,

    // Document editing
    documentContent,
    collaborativeEdits,
    pendingChanges,
    lastSyncTime,
    sendEdit,
    applyEdit,
    conflictResolution,
    setConflictResolution,

    // Comments and annotations
    comments,
    annotations,
    activeComment,
    setActiveComment,
    addComment,
    resolveComment,
    addAnnotation,

    // Typing indicators
    startTyping,
    stopTyping,

    // Voice/Video collaboration
    voiceEnabled,
    videoEnabled,
    screenSharing,
    mediaStream,
    toggleVoice,
    toggleVideo,
    toggleScreenShare,

    // Shared documents
    sharedDocuments,
    setSharedDocuments
  };

  return (
    <CollaborationContext.Provider value={value}>
      {children}
    </CollaborationContext.Provider>
  );
};