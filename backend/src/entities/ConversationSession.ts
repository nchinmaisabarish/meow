import { Entity } from '../helpers/EntityDecorator.js';
import { ExistingEntity, NewEntity } from './BaseEntity.js';
import { ObjectId } from 'mongodb';
import { User } from './User.js';

@Entity({ name: 'ConversationSessions' })
export class ConversationSession implements ExistingEntity {
  _id: ObjectId;
  userId: ObjectId;
  teamId: ObjectId;
  sessionId: string;
  metadata?: ConversationMetadata;
  lastAccessedAt: Date;
  createdAt: Date;
  updatedAt: Date;

  constructor(
    _id: ObjectId,
    userId: ObjectId,
    teamId: ObjectId,
    sessionId: string,
    lastAccessedAt: Date,
    createdAt: Date,
    updatedAt: Date
  ) {
    this._id = _id;
    this.userId = userId;
    this.teamId = teamId;
    this.sessionId = sessionId;
    this.lastAccessedAt = lastAccessedAt;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  toPlain(): PlainConversationSession {
    return {
      _id: this._id.toString(),
      userId: this.userId.toString(),
      teamId: this.teamId.toString(),
      sessionId: this.sessionId,
      metadata: this.metadata,
      lastAccessedAt: this.lastAccessedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

@Entity({ name: 'ConversationSessions' })
export class NewConversationSession implements NewEntity {
  userId: ObjectId;
  teamId: ObjectId;
  sessionId: string;
  metadata?: ConversationMetadata;
  lastAccessedAt: Date;
  createdAt: Date;
  updatedAt: Date;

  constructor(user: User, sessionId: string, metadata?: ConversationMetadata) {
    this.userId = user._id;
    this.teamId = user.teamId;
    this.sessionId = sessionId;
    this.metadata = metadata;
    this.lastAccessedAt = new Date();
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}

export interface PlainConversationSession {
  _id: string;
  userId: string;
  teamId: string;
  sessionId: string;
  metadata?: ConversationMetadata;
  lastAccessedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMetadata {
  [key: string]: string | number | boolean | null;
}
