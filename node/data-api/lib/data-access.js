//
// Data access layer, does all MongoDB operations
// ----------------------------------------------
// Ben C, March 2018
//

const utils = require('./utils');

class DataAccess {

  //
  // Initialize
  //
  constructor() {
    // Unlikely you'll ever want to change these, but you probably could
    this.DBNAME = 'smilrDb';
    this.EVENT_COLLECTION = 'events';
    this.FEEDBACK_COLLECTION= 'feedback'; 

    this.MongoClient = require('mongodb').MongoClient;
  }

  //
  // Connect to MongoDB server, with retry logic
  //
  async connectMongo(connectionString, retries, delay, force = false) {
    let mongoErr
    let retry = 0;
    let mongoHost = require('url').parse(connectionString).host;

    while(true) {
      console.log(`### Connection attempt ${retry+1} to MongoDB instance: ${mongoHost}`)

      if(!this.db || force) {
        // Use await and connect to Mongo
        await this.MongoClient.connect(connectionString, { useNewUrlParser: true, useUnifiedTopology: true, reconnectInterval: 5000, reconnectTries: 20 })
        .then(db => {
          // Switch DB to smilr, which will create it, if it doesn't exist
          this.db = db.db(this.DBNAME);
          console.log(`### Yay! Connected to MongoDB`)
        })
        .catch(err => {
          mongoErr = err
        });
      }

      // If we don't have a db object, we've not connected - retry
      if(!this.db) {
        retry++;        
        if(retry < retries) {
          console.log(`### MongoDB connection attempt failed, retrying in ${delay} seconds`);
          await utils.sleep(delay * 1000);
          continue;
        }
      }
      
      // Return promise, if we have a db, resolve with it, otherwise reject with error
      return new Promise((resolve, reject) => {
        if(this.db) { resolve(this.db) }
        else { reject(mongoErr) }
      });
    }
  }

  //
  // Data access methods for event documents
  //

  queryEvents(query) {
    return this.db.collection(this.EVENT_COLLECTION).find(query).toArray();
  }

  getEvent(id) {
    return this.db.collection(this.EVENT_COLLECTION).findOne({_id: id})
  }

  deleteEvent(id, type) {
    return this.db.collection(this.EVENT_COLLECTION).deleteOne({_id: id, type: type})
  }

  // Used to both create and update events. NOTE doUpsert=true is only used by demoData loading script
  createOrUpdateEvent(event, doUpsert) {
    if (event._id) {
      return this.db.collection(this.EVENT_COLLECTION).updateOne({_id: event._id, type: event.type}, {$set: event}, {upsert: doUpsert});
    } else {
      // Create a random short-code style id for new events
      // IMPORTANT!
      // We have to create our own id as a string, because Azure Functions can't handle MongoDB self generated ids
      event._id = utils.makeId(5);
      return this.db.collection(this.EVENT_COLLECTION).insertOne(event);
    }
  }

  //
  // Data access methods for feedback documents
  //

  listFeedbackForEventTopic(eventid, topicid) {
    return this.db.collection(this.FEEDBACK_COLLECTION).find({$and: [{event: eventid}, {topic: topicid}]}).toArray();
  }

  createFeedback(feedback) {
    // IMPORTANT!
    // We have to create our own id as a string, because Azure Functions can't handle MongoDB self generated idss
    feedback._id = utils.makeId(12);
    return this.db.collection(this.FEEDBACK_COLLECTION).insertOne(feedback)
  }
}

// Create a singleton instance which is exported NOT the class 
const self = new DataAccess();
module.exports = self;
