const db = require("./db.js");
const startup = require("./startup.js");
const CARDSTABLE = db.CARDSTABLE;

startup.start(updateCardsTable);

function updateCardsTable(responseStr) {
    let cardsArr = JSON.parse(responseStr);

    return db.runQuery({
        text: `SELECT * FROM ${CARDSTABLE};`
    }).then((res) => {
        let dbArr = res.rows.map(row => row.card_id);
        let insertsArr = getInsertsArr(dbArr, cardsArr);

        console.log(`${insertsArr.length} new cards to insert`);
        if (insertsArr.length > 0) {
            console.log(insertsArr);
            db.insertCards(insertsArr).then(
                res => console.log(`${res.command} ${res.rowCount} rows into ${CARDSTABLE}`),
                errResponse
            );
        }
    }, errResponse);
}

function getInsertsArr(dbArr, apiArr) {
    let insertsArr = [];

    for (let i = 0, n = apiArr.length; i < n; i++) {
        let cardID = apiArr[i].id;

        if (!dbArr.includes(cardID)) {
            insertsArr.push(apiArr[i]);
        }
    }

    return insertsArr;
}

function errResponse(err) {
    console.log(err);
    db.end();
}
