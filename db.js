const { Client } = require("pg");
const dbConfig = require("./ignore/dbConfig.json");
const CARDSTABLE = "cards";
const CARDCOLLECTIONSTABLE = "card_collections";
const cardsCols = ["card_id", "name", "cost", "attack", "health", "rarity", "cardClass", "set", "type", "text", "flavor", "mechanics", "dbfId"]

let client;

function connect() {
    let connectionPromise;

    client = new Client(dbConfig);
    connectionPromise = client.connect().then((err) => {
        if (err) {
            console.error('connection error', err.stack);
        } else {
            console.log('connection established');
        }
    });
    client.on("end", () => console.log("connection terminated"));

    return connectionPromise;
}

function end() {
    try {
        client.end().then(
            () => console.log("client has disconnected"),
            err => console.error("error during disconnection", err.stack)
        );
    } catch(err) {
        console.log(err);
    }
}

function insertCards(cards) {
    let inputCount = 1;
    let valsArr = [];
    let valsStr = cards.map((card, i) => {
        let colValArr = [];
        for (let i = 0, n = cardsCols.length; i < n; i++) {
            let colVal = card[i === 0 ? "id" : cardsCols[i]];
            let colValStr = "NULL";

            if (colVal != null) {
                colValStr = `$${inputCount++}`;
                valsArr.push(colVal);
            }

            colValArr.push(colValStr);
        }
        return `(${colValArr.join(", ")})`
    }).join(",");
    let queryText = `\
        INSERT INTO ${CARDSTABLE}\
            (${cardsCols.join(", ")})\
        VALUES ${valsStr}`;

    return runQuery({
        text: queryText,
        values: valsArr
    });
}

function deleteCards(cards) {
    let valsStr = cards.map((card, i) => `$${i + 1}`).join(", ");
    let queryText = `\
        DELETE FROM ${CARDSTABLE}\
        WHERE name IN (${valsStr})`;

    return runQuery({
        text: queryText,
        values: cards
    });
}

function insertCardCollection(username, cards) {
    let inputCount = 1;
    let valsArr = [];
    let valsStr = cards.map((card, i) => {
        valsArr = valsArr.concat([username, card.id, card.normalCount, card.goldenCount]);
        return `($${inputCount++}, $${inputCount++}, $${inputCount++}, $${inputCount++})`
    }).join(",");
    let queryText = `\
        INSERT INTO ${CARDCOLLECTIONSTABLE}\
            (username, card_id, normal_count, golden_count)\
        VALUES ${valsStr}`;

    return runQuery({
        text: queryText,
        values: valsArr
    });
}

function updateCardCollection(username, updates) {
    let inputCount = 1;
    let valsArr = [];
    let normalCaseArr = [];
    let goldenCaseArr = [];
    let whereArr = [];
    let queryText;

    for (let i = 0, n = updates.length; i < n; i++) {
        let idIndex = inputCount;
        let card = updates[i];

        whereArr.push(`$${idIndex}`);
        normalCaseArr.push(`WHEN $${inputCount++} THEN $${inputCount++}`);
        goldenCaseArr.push(`WHEN $${idIndex} THEN $${inputCount++}`);
        valsArr = valsArr.concat([card.id, card.normalCount, card.goldenCount]);
    }

    valsArr.push(username);
    queryText = `\
        UPDATE ${CARDCOLLECTIONSTABLE}
            SET normal_count = CASE card_id
                ${normalCaseArr.join("\n")}
                ELSE normal_count
                END,
                golden_count = CASE card_id
                ${goldenCaseArr.join("\n")}
                ELSE golden_count
                END
            WHERE card_id IN (${whereArr.join(", ")}) AND username = $${inputCount}`;

    return runQuery({
        text: queryText,
        values: valsArr
    });
}

function runQuery(query) {
    return client.query(query);
}

module.exports = {
    connect: connect,
    end: end,
    insertCards: insertCards,
    deleteCards: deleteCards,
    insertCardCollection: insertCardCollection,
    updateCardCollection: updateCardCollection,
    runQuery: runQuery,
    CARDSTABLE: CARDSTABLE,
    CARDCOLLECTIONSTABLE: CARDCOLLECTIONSTABLE
};
