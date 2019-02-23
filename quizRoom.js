const categoryToQuestion = require('./config.js').categoryToQuestion;

var randomInt = require('random-int');
var microtime = require('microtime');

const GameState = {
    IDLE: 'Idle',
    PLAY: 'Play',
    RESULT: 'Result',
    ADS: 'Ads',
};

const StateDurations = {
    'Idle': 0.5,
    'Play': 21,
    'Result': 2,
    'Ads': 60
};

const RoundState = {
    Started: 1,
    Finished: 2
};

class QuizRound {
    constructor(io, roundId) {
        this.roundId = roundId;
        this.io = io;

        this.numberOfAnswers = 0;
        var randomCategoryId = randomInt(1, 9);
        var numberOfQuestionsInCategory = categoryToQuestion[randomCategoryId].length;
        var randomQuestionId = randomInt(0, numberOfQuestionsInCategory);
        this.question = categoryToQuestion[randomCategoryId][randomQuestionId];
        this.timeStarted = microtime.now();
        this.roundState = RoundState.Started;
        var self = this;
        this.clock = setInterval(function() {
            self.update();
        }, 950);

        this.answers = [0, 0, 0, 0];

    }

    isCorrectAnswer(choice) {
        if(this.question.trueAnswer == parseInt(choice)) {
            return true;
        }

        return false;
    }

    addAnswer(choice) {
        this.answers[choice] += 1;
        this.currentRound.numberOfAnswers += 1;
    }

    getOutput() {

        var question = this.question;

        return {'question': {
                'text': question.text,
                'choices': question.choices,
                'trueAnswer': question.trueAnswer,
                },
            'roundId': this.roundId
            }
    }
    getTimeLeft() {
        var nowInMicroSec = microtime.now();
        return StateDurations[GameState.PLAY] - (nowInMicroSec - this.timeStarted) / 1e6;
    }
    update(){
        var timeLeft = this.getTimeLeft();
        if( timeLeft <= 0) {
            this.roundState = RoundState.Finished;
            console.log('round finished');
            clearInterval(this.clock);
        }

        this.io.in('quiz room').emit('realtime', {'timeLeft': parseInt(timeLeft), 'numberOfAnswers': this.numberOfAnswers});
    }

}

module.exports = class QuizRoom {


    constructor(io) {
        this.io = io;
        this.users = [];

        this.gameState = GameState.IDLE;
        this.rounds = [];
        this.currentRound = undefined;
        this.timeoutClock = undefined;

        var self = this;
        setInterval(function() {
            self.update();
        }, 100);

    }


    update(){

        switch (this.gameState){
            case GameState.IDLE:
                this.currentRound = new QuizRound(this.io, this.rounds.length);
                this.gameState = undefined;

                var self = this;
                clearTimeout(this.timeoutClock);
                this.timeoutClock = setTimeout(function() {
                    self.gameState = GameState.PLAY;

                    self.io.in('quiz room').emit('play', self.currentRound.getOutput());
                    console.log('GameState changed to PLAY');

                }, StateDurations[GameState.IDLE]*1000);
                break;
            case GameState.PLAY:
                if(this.currentRound != undefined && this.currentRound.roundState != RoundState.Finished) {
                    break;
                }

                this.gameState = GameState.RESULT;

                this.users.sort(function(a, b) {
                   return b.score - a.score;
                });

                var scoreboard = [];
                for(var user in this.users)
                    scoreboard.push({'name':user.name, 'score':user.score});


                this.io.in('quiz room').emit('results', {
                    'summary': this.currentRound.answers,
                    'scoreboard': scoreboard
                });

                // Store the old round in rounds array.
                this.rounds.push(this.currentRound);
                clearInterval(this.currentRound.clock);
                this.currentRound = undefined;

                clearTimeout(this.timeoutClock);
                var self = this;
                this.timeoutClock = setTimeout(function() {

                    self.gameState = GameState.IDLE;
                }, StateDurations[GameState.RESULT]*1000);

                break;

            case GameState.ADS:

                break;
        }
    }

    addUser(user) {
        this.users.push(user);
        user.socket.join('quiz room');
        if (this.currentRound != null){
            user.socket.emit('play', this.currentRound.getOutput());
        }
        user.socket.emit('general', {'stateDurations': StateDurations,
            'name': user.name});

        user.socket.on('move', function(message){
            if(this.gameState != GameState.PLAY || this.currentRound.roundState != RoundState.Started){
                user.socket.emit('siktir git');
                return false;
            }
            if(this.currentRound.isCorrectAnswer(message.choice)){
                user.addScore(this.currentRound.getTimeLeft() + 10);
            }
            this.currentRound.addAnswer(message.choice);
        });


    }

    removeUser(user){
        for (var i = 0; i < this.users.length; i++) {
            if(user == this.users[i]) {
                this.users.splice(i, 1);
            }
        }
    }
}
