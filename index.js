const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config()
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId, Timestamp } = require('mongodb');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// middleware =====
const corsOptions = {
  origin: ['http://localhost:5173', 'https://dev-forum-1d988.web.app', 'https://dev-forum-1d988.firebaseapp.com', 'https://dev-forum-platform-server-side.vercel.app']
};
app.use(cors(corsOptions))
app.use(express.json());

// Verify Token Middleware
const verifyToken = (req, res, next) => {
  // console.log('inside verify token', req.headers.authorization);
  if(!req.headers.authorization){
    return res.status(401).send({message: 'unauthorized access'})
  }
  const token = req.headers.authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if(err){
      return res.status(401).send({message: 'unauthorized access'})
    }
    req.decoded = decoded;
    next();
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
    // await client.connect();

    const postedCollection = client.db('devForum').collection('postedData');
    const usersCollection = client.db('devForum').collection('users');
    const announcementCollection = client.db('devForum').collection('announcement');
    const paymentCollection = client.db('devForum').collection('payments');
    const commentsCollection = client.db('devForum').collection('comments');
    const reportsCollection = client.db('devForum').collection('report');
    const feedbackCollection = client.db('devForum').collection('feedback');


    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = {email: email};
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if(!isAdmin){
        return res.status(403).send({message: 'forbidden access'});
      }
      next();
    }

    // auth related api ======== jwt==========
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
           expiresIn: '365d' 
        })
        console.log(token, 'this is token');
      res.send({token})
    })

    // Logout =========== token ======== jwt======
    app.get('/logout', async (req, res) => {
      try {
        res.send({ success: true })
        console.log('Logout successful')
      } catch (err) {
        res.status(500).send(err)
      }
    })

    //  create-payment-intent on the server side ===
    app.post('/create-payment-intent', verifyToken, async (req, res) => {
      // generate client secret===========
      const {client_secret} = await stripe.paymentIntents.create({
        amount: 69 * 100,
        currency: "usd",
        // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
        automatic_payment_methods: {
          enabled: true,
        },
      })

      // send client secret as a response
      res.send({clientSecret: client_secret})
    })


    // user save to database ====
    app.put('/user', async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      // check if user is already exists in Database 
      const isExist = await usersCollection.findOne(query);
      if (isExist) return res.send(isExist);
      const options = { upsert: true };
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
    app.get('/user/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send(result)
    })

    // get all user in user collection from admin dashboard=======
    app.get('/users', verifyToken,  async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result)
    })

    // update a user role admin/user ========
    app.patch('/users/update/:email', verifyToken, verifyAdmin, async (req, res) => {
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

    // upVote count and down vote count ==============
    app.patch('/posted/upVote/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const postedData = req.body;
      const query = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: {
          ...postedData
        }
      }
      const result = await postedCollection.updateOne(query, updateDoc);
      res.send(result)
    })

    // update user badge on user collection ====
    app.put('/payment/update/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = {email};
      const updateDoc = {
        $set: {
          ...user,
          Timestamp: Date.now()
        }
      }
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result)
    })

    // save the payment user information 
    app.post('/payments', verifyToken, async(req, res) => {
      const payments = req.body;
      const result = await paymentCollection.insertOne(payments);
      res.send(result);
    })

    // get to postedData all data see all user home page or pagination and sorting and searching========
    app.get('/postedData', async (req, res) => {
      const search = req.query.search;
      const tags = req.query.tags;
      const page = parseInt(req.query.page) - 1;
       const size = parseInt(req.query.size);
       const sort = req.query.sort;
      let filter = {};
      if(search){
        console.log(search);
        filter = { tags: { $regex: search, $options: 'i' } };
      }
      else if(tags && tags !== "null") {
        filter = { tags }
      }
      let options = {};
      if(sort){
        options = {sort: {
          upVote: sort === 'asc' ? 1 : -1
        }}
      }
      const result = await postedCollection.find(filter, options).skip(page * size).limit(size).toArray();
      res.send(result)
    })

    // get all posted data form db for count =============
    app.get('/post-count', async (req, res) => {
      const search = req.query.search;
      const tags = req.query.tags;
      let filter = {};
      if(search){
        console.log(search);
        filter = { tags: { $regex: search, $options: 'i' } };
      }
      else if(tags && tags !== "null") {
        filter = { tags }
      }      
       const count = await postedCollection.countDocuments(filter);
       res.send({count});
    })

    // get single posted data for details==
    app.get('/post/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await postedCollection.findOne(query);
      res.send(result);
    })

    // add posted Data =======
    app.post('/post', verifyToken, async (req, res) => {
      const postedData = req.body;
      const result = await postedCollection.insertOne(postedData);
      res.send(result);
    })

    // email spacific post data on my profile page ====
    // user post data get=====
    app.get('/my-post/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await postedCollection.find(query).toArray();
      console.log(result);
      res.send(result);
    })

    // post delete === 
    app.delete('/post/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await postedCollection.deleteOne(query);
      res.send(result);
    })

    // all comment get admin page my user ===========
    app.get('/comments', verifyToken, async (req, res) => {
      const result = await commentsCollection.find().toArray();
      res.send(result)
    })

    // get comment from the post details page // get comment from the post my post page specific comment details page  
    app.get('/comment/:id', async (req, res) => {
      const id = req.params.id;
      const query = {postedId : id};
      const result = await commentsCollection.find(query).toArray();
      res.send(result);
    })


    // post data create new comment collection from post details page=====
    app.post('/comments', verifyToken, async (req, res) => {
      const commentDetails = req.body;
      const result = await commentsCollection.insertOne(commentDetails)
      res.send(result);
    })


    // get and display all announcement user and not user ==
    app.get('/announcementData', async (req, res) => {
      const result = await announcementCollection.find().toArray();
      res.send(result)
    })

    // save admin announcement ==========
    app.post('/announcement', verifyToken, verifyAdmin, async (req, res) => {
      const announcement = req.body;
      const result = await announcementCollection.insertOne(announcement);
      res.send(result);
    })

    // post all reports postCommentTableRow/UpdateCommentModal==
    app.post('/report/upload', async (req, res) => {
      const report = req.body;
      const result = await reportsCollection.insertOne(report);
      res.send(result);
    })
    // get all reports admin activity page ======
    app.get('/reports', verifyToken, verifyAdmin, async (req, res) => {
      const result = await reportsCollection.find().toArray();
      res.send(result)
    })

    // delete report activity page ======
    app.delete('/report/deleted/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await reportsCollection.deleteOne(query);
      res.send(result);
    })
    // comment report posted Data get post collection ========= on activity page
    app.get('/postedData/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await postedCollection.findOne(query);
      res.send(result);
    })
    
    // post all reports postCommentTableRow/UpdateCommentModal==
    app.post('/feedback/upload', async (req, res) => {
      const feedback = req.body;
      const result = await feedbackCollection.insertOne(feedback);
      res.send(result);
    })

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB! devForum ");
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