const express = require('express');
const app = express();
const cors =  require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000;

// middleware =====
app.use(cors())
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId, Timestamp } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.g2fbusk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const postedCollection = client.db('devForum').collection('postedData');
    const usersCollection = client.db('devForum').collection('users');

    // user save to database ====
    app.put('/user', async (req, res) => {
      const user = req.body;
      const query = {email: user?.email};
      // check if user is already exists in Database 
      const isExist = await usersCollection.findOne(query);
      if(isExist) return res.send(isExist);

      const options = {upsert: true}
      ;
      const updateDoc = {
        $set: {
          ...user,
          Timestamp: Date.now()
        }
      }
      const result = await usersCollection.updateOne(query, updateDoc, options);
      res.send(result)
    })

    // ====== get a user info from database=====
    app.get('/user/:email', async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({email});
      res.send(result)
    })

    // get all user in user collection =======
    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result)
    })

    // update a user role 
    app.patch('/users/update/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = {email};
      const updateDoc = {
        $set:{
          ...user,
          Timestamp: Date.now()
        }
      }
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    })

    // get to postedData ========
    app.get('/postedData', async (req, res) => {
      const tags = req.query.tags;
      let query = {};
      if(tags && tags !== "null"){
        query = {tags}
      }
      const result = await postedCollection.find(query).toArray();
      res.send(result)
    })
    // get single posted data for details==
    app.get('/post/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId (id)};
      const result = await postedCollection.findOne(query)
      res.send(result);
    })

    // add posted Data =======
    app.post('/post', async (req, res) => {
      const postedData = req.body;
      const result = await postedCollection.insertOne(postedData);
      res.send(result);
    })

    // user post data get=====
    app.get('/my-post/:email', async (req, res) => {
      const email = req.params.email;
      const query = {email: email};
      const result = await postedCollection.find(query).toArray();
      res.send(result);
    })

    // post delete 
    app.delete('/post/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId (id)};
      const result = await postedCollection.deleteOne(query);
      res.send(result);
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB! devForum ");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('DevForum Platform Limited Port running')
})
app.listen(port, () => {
    console.log(`DevForum Platform Limited server site is Running ${port}`);
})