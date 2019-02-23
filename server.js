var http = require('http');
var fs = require('fs');
var User = require('./user');
var QuizRoom = require('./quizRoom');

// Loading the index file . html displayed to the client
var server = http.createServer(function(req, res) {
    fs.readFile('./index.html', 'utf-8', function(error, content) {
        res.writeHead(200, {"Content-Type": "text/html"});
        res.end(content);
    });

});

// Loading socket.io


var io = require('socket.io').listen(server);

var quizNsp = io.of('/quiz');
var quizRoom = new QuizRoom(quizNsp);

var users = {};

quizNsp.on('connection', function (socket) {
    console.log('A client is connected!');

    var name = "Anonymous " + parseInt(Math.random()*1000 );
    var user;
    socket.on('login', function(msg) {
        user = new User(socket, name, msg.phoneId);
        if(users[msg.phoneId] != undefined){
            users[msg.phoneId].socket.disconnect();
        }
        users[msg.phoneId] = user;
        //TODO: use category list

        quizRoom.addUser(user);
    });

    socket.on('disconnect', function() {
        quizRoom.removeUser(user);
        console.log('A client is removed');
    });

});




server.listen(8080);