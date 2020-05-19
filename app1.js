var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const dbConfig = require('./database/db');
const chatroomSchema = require("./models/ChatRooms");

const Answer = require('./models/answer');
const User = require('./models/User');
const Subscriber = require('./models/subscriber');
const Blockuser = require('./models/blockuser');



// Express APIs
const authRouter = require('./routes/auth');
var indexRouter = require('./routes/index');
const adminRouter = require('./routes/admin');
// var usersRouter = require('./routes/users');

// send mail
var nodemailer = require('nodemailer');
var transporter = nodemailer.createTransport({
    service: 'gmail',
    secure: false,
    port: 587,
    auth: {
        user: 'wifball.pro@gmail.com',
        pass: 'Rubixcub001!'
    }
});
// const sendmail = require('sendmail')({
//     logger: {
//         debug: console.log,
//         info: console.info,
//         warn: console.warn,
//         error: console.error
//     },
//     silent: false,
//     dkim: { // Default: False
//         privateKey: fs.readFileSync('./dkim-private.pem', 'utf8'),
//         keySelector: 'mydomainkey'
//     },
//     devPort: 1025, // Default: False
//     devHost: 'localhost', // Default: localhost
//     smtpPort: 2525, // Default: 25
//     smtpHost: 'localhost' // Default: -1 - extra smtp host after resolveMX
// })
// const sendmail = require('sendmail')();



// MongoDB conection
mongoose.Promise = global.Promise;
mongoose.connect(dbConfig.db, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
        console.log('Database connected')
    },
    error => {
        console.log("Database can't be connected: " + error)
    }
)

// Remvoe MongoDB warning error
mongoose.set('useCreateIndex', true);

var app = express();


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());
app.use(cookieParser());

app.use(express.static('public'));

app.use('/chat', indexRouter);
app.use('/auth', authRouter);
app.use('/admin', adminRouter);

var http = require("http").createServer(app);
var io = require("socket.io")(http);
app.set('io', io);
app.set('view engine', 'pug')

// ------------------by ftf -------------------------
const mongodb = require('mongodb');
const socket = require('socket.io');
const port = 8080;
let users;
let count;
let chatRooms;
let answerRooms;
let messagesArray = [];

const MongoClient = mongodb.MongoClient;
// Allowing cross-origin sites to make requests to this API
// app.use((req, res, next) => {
//     res.append('Access-Control-Allow-Origin', 'http://localhost:4200');
//     res.append('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
//     res.append("Access-Control-Allow-Headers", "Origin, Accept,Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers");
//     res.append('Access-Control-Allow-Credentials', true);
//     next();
// });

// Connecting to MongoDB
MongoClient.connect('mongodb://localhost:27017/CrudDB', (err, Database) => {
    if (err) {
        console.log(err);
        return false;
    }
    console.log("Connected to MongoDB");
    const db = Database.db("CrudDB");
    users = db.collection("users"); // getting the users collection
    chatRooms = db.collection("chatRooms");
    answerRooms = db.collection("answerMessage");
    /* getting the chatRooms collection. 
                                                   This collection would store chats in that room*/

    // starting the server on the port number 3000 and storing the returned server variable 
    const server = app.listen(port, () => {
        console.log("Server started on port " + port + "...");
    });
    const io = socket.listen(server);

    /* 'connection' is a socket.io event that is triggered when a new connection is 
       made. Once a connection is made, callback is called. */
    io.sockets.on('connection', (socket) => {
        /* socket object allows us to join specific clients 
                                                       to chat rooms and also to catch
                                                       and emit the events.*/
        // 'join event'
        socket.on('join', (data) => {
            socket.join(data.room);
            chatRooms.find({}).toArray((err, rooms) => {
                if (err) {
                    console.log(err);
                    return false;
                }
                count = 0;
                rooms.forEach((room) => {
                    if (room.name == data.room) {
                        count++;
                    }
                });
                // Create the chatRoom if not already created
                if (count == 0) {
                    chatRooms.insert({ name: data.room, messages: [] });
                }
            });
        });
        // catching the message event
        socket.on('message', (data) => {
            // emitting the 'new message' event to the clients in that room
            var current_user;
            current_user = [{
                userId: data.userId,
                name: data.name,
                email: data.useremail,
                photoUrl: data.photoUrl,
            }];
            let currentTime = Date.now();
            // save the message in the 'messages' array of that chat-room
            chatRooms.insert({
                userId: data.userId,
                name: data.user,
                useremail: data.useremail,
                photoUrl: data.photoUrl,
                message: data.message,
                videoLink: data.videoLink,
                sendTime: currentTime,
                state: 0,
                follows: 0,
                followers: [],
                comments: [],
            }, (err, res) => {
                if (err) {
                    console.log(err);
                    return false;
                }
                io.emit('new message', {
                    _id: res.ops[0]._id,
                    userId: res.ops[0].userId,
                    name: res.ops[0].name,
                    useremail: res.ops[0].useremail,
                    photoUrl: res.ops[0].photoUrl,
                    message: res.ops[0].message,
                    videoLink: res.ops[0].videoLink,
                    sendTime: res.ops[0].sendTime,
                    state: res.ops[0].state,
                    follows: res.ops[0].follows,
                    followers: res.ops[0].followers,
                    comments: res.ops[0].comments,
                    userdetail: current_user
                });
            });
        });
        // catching the subscribe event
        socket.on('subscribePost', (data) => {
            console.log(data);
            if (data.videoId == '0') {
                chatroomSchema.findByIdAndUpdate(data.message_id, { $inc: { follows: 1 }, $push: { followers: [{ useremail: data.email, state: 0 }] } }, (err, res) => {
                    if (err) {
                        console.log(err);
                    } else {
                        Subscriber.findOne({ userId: data.userId }).then((doc) => {
                            if (!doc) {
                                console.log("...create a new field...");
                                const subscriber = new Subscriber({
                                    userId: data.userId,
                                    subscriberId: [data.subscriberId]
                                });
                                subscriber.save().then((result) => {
                                    io.emit('new subscribePost', {
                                        userId: data.userId
                                    })
                                })
                            } else {
                                Subscriber.findOne({ userId: data.userId, subscriberId: { $all: [data.subscriberId] } }).then((result) => {
                                    console.log(result);
                                    if (!result) {
                                        console.log("...update the field...");
                                        Subscriber.findOneAndUpdate({ userId: data.userId }, { $push: { subscriberId: data.subscriberId } }, (err, res) => {
                                            if (err) {
                                                console.log(err);
                                            }
                                        })
                                        io.emit('new subscribePost', {
                                            userId: data.userId
                                        })
                                    } else {
                                        console.log("..already updated...");
                                    }
                                })
                            }
                        })
                    }
                });
            } else {
                Subscriber.findOne({ userId: data.userId }).then((doc) => {
                    if (!doc) {
                        console.log("...create a new field...");
                        const subscriber = new Subscriber({
                            userId: data.userId,
                            subscriberId: [data.message_id]
                        });
                        subscriber.save().then((result) => {
                            io.emit('new subscribePost', {
                                userId: data.userId
                            })
                        });
                    } else {
                        Subscriber.findOne({ userId: data.userId, subscriberId: { $all: [data.message_id] } }).then((result) => {
                            console.log(result);
                            if (!result) {
                                console.log("...update the field...");
                                Subscriber.findOneAndUpdate({ userId: data.userId }, { $push: { subscriberId: data.message_id } }, (err, res) => {
                                    if (err) {
                                        console.log(err);
                                    }
                                })
                                io.emit('new subscribePost', {
                                    userId: data.userId
                                })
                            } else {
                                console.log("..already updated...");
                            }
                        })
                    }
                });
            }
        });
        // catching the unsubscribe event
        socket.on('unsubscribePost', (data) => {
            chatroomSchema.findByIdAndUpdate(data.message_id, { $inc: { follows: -1 }, $pull: { 'followers': { useremail: data.email } } }, (err, res) => {
                if (err) {
                    console.log(err);
                    return false;
                } else {
                    Subscriber.findOne({ userId: data.userId }).then((doc) => {
                        if (!doc) {
                            console.log("...already removed...");
                        } else {
                            Subscriber.findOne({ userId: data.userId, subscriberId: { $all: [data.subscriberId] } }).then((result) => {
                                if (result) {
                                    console.log("...remove and update the field...");
                                    Subscriber.findOneAndUpdate({ userId: data.userId }, { $pull: { subscriberId: data.subscriberId } }, (err, res) => {
                                        if (err) {
                                            console.log(err);
                                        }
                                    })
                                    io.emit('new unsubscribePost', {
                                        userId: data.userId
                                    })
                                }
                            })
                        }
                    })
                }
            });

        });
        // catching the answer event
        socket.on('answer', (data) => {
                // console.log(data);
                let currentTime = Date.now();
                let userinfo;
                User.findById(data.id, (err, res) => {
                    userinfo = res;
                });
                // update the chatrooms  - add comments
                chatroomSchema.findByIdAndUpdate(data.message_id, { $push: { comments: [{ comment_user: data.current_user, comment_message: data.message, comment_video: data.videoLink }] } }, (err, res) => {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log(res);
                        }
                    })
                    // update the 
                Answer.findOneAndUpdate({ message_id: data.message_id, owner: data.userId, client: data.id }, { answer_state: '1' }, (err, res) => {
                    if (err) {
                        console.log(err);
                    }
                });
                Answer.findOne({ message_id: data.message_id, 'owner': data.id, 'client': data.userId }).then((doc) => {
                    if (!doc) {
                        console.log("--create a new field...");
                        const answer = new Answer({
                            message_id: data.message_id,
                            owner: data.id,
                            client: data.userId,
                            relative: '1',
                            answer_state: '0',
                            answer: [{
                                message: data.message,
                                videoLink: data.videoLink,
                                sendTime: currentTime,
                            }]
                        });
                        answer.save().then((result) => {
                            // console.log(result);
                            io.emit('new answer', {
                                owner: data.id,
                                client: data.userId,
                                answer: [{
                                    message: data.message,
                                    videoLink: data.videoLink,
                                    sendTime: currentTime
                                }],
                                message_id: data.message_id,
                                relative: '1',
                                answer_state: '0',
                                userdetail: [userinfo]
                            });
                        })
                        console.log("..update the chatRooms the followers state...");
                        // console.log(data.current_user);
                        chatroomSchema.findOneAndUpdate({ '_id': data.message_id, 'followers.useremail': data.current_user }, { $set: { 'followers.$.state': 1 } }, (err, res) => {
                            if (err) {
                                console.log(err);
                            } else {
                                console.log(res);
                            }
                        })
                    } else {
                        console.log("--update the answerMessage...");
                        Answer.findOneAndUpdate({ 'owner': data.id, 'client': data.userId }, {
                            answer_state: '0',
                            $push: {
                                answer: [{
                                    message: data.message,
                                    videoLink: data.videoLink,
                                    sendTime: currentTime,
                                }]
                            }
                        }, (err, res) => {
                            if (err) {
                                console.log(err);
                            } else {
                                console.log(res);
                                io.emit('new answer', {
                                    owner: data.id,
                                    client: data.userId,
                                    answer: [{
                                        message: data.message,
                                        videoLink: data.videoLink
                                    }],
                                    message_id: data.message_id,
                                    userdetail: [userinfo]
                                })
                            }
                        })
                    }
                }).catch(e => function(e) {
                    console.log(e);
                })
                console.log("...sendding email...")
                console.log(data.to_user_email);
                var mailOptions = {
                    from: 'wifball.pro@gmail.com',
                    to: data.to_user_email,
                    subject: 'From the Wifball',
                    text: data.message + '\n' + 'Videolink:' + data.videoLink + '\n' + 'from:' + data.current_user,
                };

                transporter.sendMail(mailOptions, function(error, info) {
                    if (error) {
                        console.log(error);
                    } else {
                        console.log('Email sent: ' + info.response);
                    }
                });
                console.log("....sended email..please check");
            })
            // blocking the client user
        socket.on('block message', (data) => {
                console.log('...update the block message...');
                console.log(data);
                Blockuser.findOneAndUpdate({ userId: data.userId }, { $push: { blockId: data.clientId } }, (err, res) => {
                    if (err) {} else {

                        console.log(res);
                        if (res === null) {
                            const blockuser = new Blockuser({
                                userId: data.userId,
                                blockId: [data.clientId]
                            });
                            blockuser.save().then((result) => {
                                console.log("...add the data in the blocking table...");
                                console.log(result);
                            });
                        } else {
                            console.log("...update the data of blocking table...");
                        }
                    }
                })
            })
            // unblocking the client user
        socket.on('unblock message', (data) => {
            console.log('...delete the unblock message...');
            console.log(data);
            Blockuser.findOneAndUpdate({ userId: data.userId }, { $pull: { blockId: data.clientId } }, (err, res) => {
                if (err) {
                    console.log(err);
                } else {
                    console.log("...delete the data of blocking table...");
                    console.log(res);
                }
            })
        })

        // Event when a client is typing
        socket.on('typing', (data) => {
            // Broadcasting to all the users except the one typing 
            socket.broadcast.in(data.room).emit('typing', { data: data, isTyping: true });
        });
    });

});

app.get('/chatroom/:id', (req, res, next) => {
    let cuser;
    console.log("this is the get chatrooms time bigger");
    console.log(req.params.id);
    User.findById(req.params.id, (err, ress) => {
        cuser = ress;
        console.log("this is the get chatrooms time bigger----------");
        console.log(cuser.refresh);
        chatRooms.aggregate([{
            $match: {
                state: 0,
                sendTime: { $gte: parseInt(cuser.refresh)  }
            }
        }, {
            $lookup: {
                from: 'users',
                let: { chat_email: "$useremail" },
                pipeline: [{
                    $match: {
                        $expr: {
                            $and: [
                                { $eq: ["$$chat_email", "$email"] }
                            ]
                        }
                    }
                }],
                as: 'userdetail'
            },
        }]).toArray(function(err, chatroom) {
            if (err) {
                console.log(err);
                return false;
            };
            res.send(chatroom);
        });
    }).catch((e) => {
        console.log(e);
        res.send();
    });
    
})

app.get('/response/:id', async(req, res, next) => {
    console.log(req.params.id);
    var ObjectID = require('mongodb').ObjectID;
    let list = await Answer.aggregate([{
        $match: {
            client: ObjectID(req.params.id),
            answer_state: '0'
        }
    }, {
        $project: {
            answer: {
                $slice: ["$answer", -1]
            },
            owner: 1,
            message_id: 1,
            client: 1,
        }
    }, {
        $lookup: {
            from: 'users',
            localField: 'owner',
            foreignField: '_id',
            as: 'userdetail'
        }
    }]);
    res.send(list);
})

// get the subscribers
app.get('/subscribe/:id', async(req, res, next) => {
        var ObjectID = require('mongodb').ObjectID;
        await Subscriber.findOne({ userId: ObjectID(req.params.id) }).then((doc) => {
            if (!doc) {
                res.send({ re: '0' });
            } else {
                let re = doc.subscriberId.length.toString();
                res.send({ re: re });
            }
        })
    })
    // ---------------- by ftf ---------------------------

// http.listen(port, function() {
//     console.log("LOG:: listening on *:3000");
// });