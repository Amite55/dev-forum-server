const express = require('express');
const app = express();
const cors = require('cors');
const cookieParser = require('cookie-parser')
require('dotenv').config()
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId, Timestamp } = require('mongodb');


// middleware =====
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json());
app.use(cookieParser());

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token
  console.log(token)
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err)
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
    next()
  })
}



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
    const announcementCollection = client.db('devForum').collection('announcement');



    // auth related api ======== jwt==========
    app.post('/jwt', async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })

    // Logout =========== token ======== jwt======
    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true })
        console.log('Logout successful')
      } catch (err) {
        res.status(500).send(err)
      }
    })


    // user save to database ====
    app.put('/user', async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      // check if user is already exists in Database 
      const isExist = await usersCollection.findOne(query);
      if (isExist) return res.send(isExist);

      const options = { upsert: true }
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
      const result = await usersCollection.findOne({ email });
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
      const query = { email };
      const updateDoc = {
        $set: {
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
      if (tags && tags !== "null") {
        query = { tags }
      }
      const result = await postedCollection.find(query).toArray();
      res.send(result)
    })
    // get single posted data for details==
    app.get('/post/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
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
      const query = { email: email };
      const result = await postedCollection.find(query).toArray();
      res.send(result);
    })

    // post delete 
    app.delete('/post/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await postedCollection.deleteOne(query);
      res.send(result);
    })

    // get and display all announcement ==
    app.get('/announcementData', async (req, res) => {
      const result = await announcementCollection.find().toArray();
      res.send(result)
    })

    // save admin announcement ==========
    app.post('/announcement', async (req, res) => {
      const announcement = req.body;
      const result = await announcementCollection.insertOne(announcement);
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