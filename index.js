const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 5000;
require("dotenv").config();
const jwt = require("jsonwebtoken"); //TODO: require('crypto').randomBytes(64).toString('hex')

const app = express();

//?----> middlewares start
app.use(cors());
app.use(express.json()); //! Admin: vinayo8123@glumark.com , warner@david.com / Chandpurasi1!

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("unauthorized access");
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send("forbidden access");
    }
    req.decoded = decoded;
    next();
  });
}
//?----> middlewares end
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2lbo3hl.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const appoinmentOptionsCollection = client
      .db("doctorsPortal")
      .collection("appoinmentOptions");
    const bookingCollection = client
      .db("doctorsPortal")
      .collection("bookingCollection");
    const userCollection = client
      .db("doctorsPortal")
      .collection("userCollection");
    const doctorsCollection = client
      .db("doctorsPortal")
      .collection("doctorsCollection");

    //?-----> verify admin jwt middleware starts
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await userCollection.findOne(query);
      if (user?.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    //?-----> verify admin jwt middleware ends

    app.get("/test", async (req, res) => {
      try {
        const test = await appoinmentOptionsCollection.find({}).toArray();
        res.send(test);
      } catch (error) {
        res.send(error.message);
      }
    });

    //TODO: get all the services options
    app.get("/appoinmentOptions", async (req, res) => {
      try {
        const date = req.query.date;
        const query = {};
        const services = await appoinmentOptionsCollection
          .find(query)
          .toArray();

        //? get the bookings of the provided date
        const bookingQuery = { appoinmentDate: date };
        const alreadyBooked = await bookingCollection
          .find(bookingQuery)
          .toArray();

        //? code carefully:-
        services.forEach((service) => {
          const serviceBookedNames = alreadyBooked.filter(
            (book) => book.treatment === service.name
          );

          //! map kora hoise karon slots er data Array hishabe ase.
          const serviceBookedSlots = serviceBookedNames.map(
            (book) => book.slot
          );
          const remainingSlots = service.slots.filter(
            (slot) => !serviceBookedSlots.includes(slot)
          );
          service.slots = remainingSlots;
        });

        res.send(services);
      } catch (error) {
        res.send(error.message);
      }
    });

    //TODO: get all services name: .project()
    app.get("/appoinmentSpecialty", async (req, res) => {
      try {
        const query = {};
        const result = await appoinmentOptionsCollection
          .find(query)
          .project({ name: 1, _id: 0 })
          .toArray();
        res.send(result);
      } catch (error) {
        res.send(error.message);
      }
    });

    //TODO: booking data save to db
    app.post("/bookings", async (req, res) => {
      try {
        const booking = req.body;
        const query = {
          treatment: booking.treatment,
          appoinmentDate: booking.appoinmentDate,
          email: booking.email,
        };

        //! jodi oi same date a same user er booking thake tahole ((acknowledged: false)) return kore dibe
        const alreadyBooked = bookingCollection.find(query).toArray();
        if ((await alreadyBooked).length) {
          const message = `you already have a booking for: "${booking.treatment}"`;
          return res.send({ acknowledged: false, message });
        }

        const result = await bookingCollection.insertOne(booking);
        res.send(result);
      } catch (error) {
        res.send(error.message);
      }
    });

    //TODO: get all the booking datas
    app.get("/bookings", verifyJWT, async (req, res) => {
      try {
        const email = req.query.email;
        const decodedEmail = req.decoded.email;
        if (email !== decodedEmail) {
          return res.status(403).send({ message: "forbidden access" });
        }
        const query = { email: email };
        const bookings = await bookingCollection.find(query).toArray();
        res.send(bookings);
      } catch (error) {
        res.send(error.message);
      }
    });

    app.get("/allBookings", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const query = {};
        const result = await bookingCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.send(error.message);
      }
    });

    app.delete("/allBookings/:id", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const result = await bookingCollection.deleteOne(filter);
        res.send(result);
      } catch (error) {
        res.send(error.message);
      }
    });

    //TODO: Create me a JWT token
    app.get("/jwt", async (req, res) => {
      try {
        const email = req.query.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        if (user) {
          const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
            expiresIn: "1h",
          });
          return res.send({ accessToken: token });
        }
        res.status(403).send({ accessToken: "" });
      } catch (error) {}
    });

    //TODO: save user information on db
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        const result = await userCollection.insertOne(user);
        res.send(result);
      } catch (error) {
        res.send(error?.message);
      }
    });

    //TODO: delete a user
    app.delete("/users/:id", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const result = await userCollection.deleteOne(filter);
        res.send(result);
      } catch (error) {
        res.send(error.message);
      }
    });

    //TODO: get all user from db
    app.get("/users", async (req, res) => {
      try {
        const query = {};
        const users = await userCollection.find(query).toArray();
        res.send(users);
      } catch (error) {
        res.send(error.message);
      }
    });

    //TODO: make admin role
    app.put("/users/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(
          filter,
          updatedDoc,
          options
        );
        res.send(result);
      } catch (error) {
        res.send(error.message);
      }
    });

    //TODO: check user admin or not
    app.get("/users/admin/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const query = { email };
        const user = await userCollection.findOne(query);
        res.send({ isAdmin: user?.role === "admin" });
      } catch (error) {
        res.send(error.message);
      }
    });

    //TODO: upload a doctor
    app.post("/doctors", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const doctor = req.body;
        const result = await doctorsCollection.insertOne(doctor);
        res.send(result);
      } catch (error) {
        res.send(error.message);
      }
    });

    //TODO: get all uploaded doctors info
    app.get("/doctors", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const query = {};
        const doctors = await doctorsCollection.find(query).toArray();
        res.send(doctors);
      } catch (error) {
        res.send(error.message);
      }
    });

    app.get("/allDoctors", async (req, res) => {
      try {
        const query = {};
        const result = await doctorsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.send(error.message);
      }
    });

    //TODO: delete a doctor permanently
    app.delete("/doctors/:id", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const result = await doctorsCollection.deleteOne(filter);
        res.send(result);
      } catch (error) {
        res.send(error.message);
      }
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", async (req, res) => {
  res.send("Doctors portal server is running....");
});

app.listen(port, () => console.log(`Doctors portal server running on ${port}`));
