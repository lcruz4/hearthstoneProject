const http = require("https");
const db = require("./db.js");

let options = {
    host: "api.hearthstonejson.com",
    path: "/v1/latest/enUS/cards.collectible.json",
    headers: {
        "Api-User-Agent": "HSDB/1.1 (http://www.luiscruzgmu.com; luiscruzgmu@gmail.com)"
    }
};

function start(callback) {
    db.connect().then(err => {
        if (!err) {
            sendRequest().then(callback)
        }
    });
}

function sendRequest() {
    return new Promise((resolve, reject) => {
        http.request(options, handleResponse.bind(null, resolve, reject)).end();
    });
}

function handleResponse(resolve, reject, response) {
    let str = "";

    //another chunk of data has been recieved, so append it to `str`
    response.on("data", chunk => str += chunk);

    //the whole response has been recieved, so we just print it out here
    response.on("end", () => {
        if (response.statusCode === 302) {
            options.path = response.headers.location.replace(`https://${options.host}`, "");
            sendRequest().then(resolve);
        } else {
            resolve(str);
        }
    });
}

module.exports = {
    start: start
};