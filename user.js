
module.exports =  class User{

    constructor(socket, phoneId, name){
        this.socket = socket;
        this.phoneId = phoneId;
        this.name = name;
        this.score = 0;
    }

    addScore(score) {
        this.score += score;
    }

}