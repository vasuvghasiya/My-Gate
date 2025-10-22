const { getDb } = require('../config/firebase');

const logAuditEvent = async ({ type, actorUserId, subjectId, payload }) => {
  try {
    const db = getDb();
    
    const auditEvent = {
      type,
      actorUserId,
      subjectId,
      payload,
      timestamp: new Date(),
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    // Store in audit collection (immutable)
    await db.collection('audit_events').add(auditEvent);
    
    console.log(`📝 Audit event logged: ${type} by ${actorUserId} on ${subjectId}`);
    return auditEvent;
  } catch (error) {
    console.error('Error logging audit event:', error);
    throw error;
  }
};

const getAuditEvents = async (filters = {}) => {
  try {
    const db = getDb();
    let query = db.collection('audit_events').orderBy('timestamp', 'desc');

    // Apply filters
    if (filters.type) {
      query = query.where('type', '==', filters.type);
    }
    
    if (filters.actorUserId) {
      query = query.where('actorUserId', '==', filters.actorUserId);
    }
    
    if (filters.subjectId) {
      query = query.where('subjectId', '==', filters.subjectId);
    }
    
    if (filters.startDate) {
      query = query.where('timestamp', '>=', filters.startDate);
    }
    
    if (filters.endDate) {
      query = query.where('timestamp', '<=', filters.endDate);
    }

    // Limit results
    const limit = filters.limit || 100;
    query = query.limit(limit);

    const snapshot = await query.get();
    const events = [];

    snapshot.forEach(doc => {
      events.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return events;
  } catch (error) {
    console.error('Error fetching audit events:', error);
    throw error;
  }
};

const getAuditStats = async (timeRange = 24) => {
  try {
    const db = getDb();
    const now = new Date();
    const startTime = new Date(now.getTime() - (timeRange * 60 * 60 * 1000));

    const snapshot = await db.collection('audit_events')
      .where('timestamp', '>=', startTime)
      .get();

    const stats = {
      total: snapshot.size,
      byType: {},
      byActor: {},
      timeRange: `${timeRange} hours`
    };

    snapshot.forEach(doc => {
      const event = doc.data();
      
      // Count by type
      stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;
      
      // Count by actor
      stats.byActor[event.actorUserId] = (stats.byActor[event.actorUserId] || 0) + 1;
    });

    return stats;
  } catch (error) {
    console.error('Error getting audit stats:', error);
    throw error;
  }
};

module.exports = {
  logAuditEvent,
  getAuditEvents,
  getAuditStats
};
