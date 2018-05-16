const fs = require("fs");
const db = require("./db.js");
const startup = require("./startup.js");
const CARDCOLLECTIONSTABLE = db.CARDCOLLECTIONSTABLE;

startup.start(getCardCollection);

function getCardCollection(responseStr) {
    let username = "kayzingzingy";
    let cardsArr = JSON.parse(responseStr);
    let normalCardsPromise = new Promise((resolve) =>
        fs.readFile("./ignore/kayzingzingyNormal.csv", "utf8", handleReadNormalFile.bind(null, resolve, cardsArr, false))
    );
    let goldenCardsPromise = new Promise((resolve) =>
        fs.readFile("./ignore/kayzingzingyGolden.csv", "utf8", handleReadNormalFile.bind(null, resolve, cardsArr, true))
    );
    let getCurrentCollectionPromise = db.runQuery({
        text: `SELECT card_id, normal_count, golden_count FROM ${CARDCOLLECTIONSTABLE} where username = $1;`,
        values: [username]
    });

    Promise.all([normalCardsPromise, goldenCardsPromise, getCurrentCollectionPromise]).then(response => {
        let normalCards = response[0];
        let goldenCards = response[1];
        let queryResponse = response[2];
        let insertsUpdatesArr = getInsertsAndUpdatesArr(queryResponse.rows, mergeCardCollections(normalCards, goldenCards));
        let insertsArr = insertsUpdatesArr[0];
        let updatesArr = insertsUpdatesArr[1];

        if (insertsArr.length === 0 && updatesArr.length === 0) {
            console.log(`${username}'s collection is up to date.`);
        }
        if (insertsArr.length > 0) {
            console.log(`Inserting ${insertsArr.length} card${insertsArr.length > 1 ? "s" : ""} into ${username}'s collection.`);
            db.insertCardCollection(username, insertsArr);
        }
        if (updatesArr.length > 0) {
            console.log(`Updating ${updatesArr.length} card${updatesArr.length > 1 ? "s" : ""} in ${username}'s collection.`);
            db.updateCardCollection(username, updatesArr);
        }
    });
}

function handleReadNormalFile(resolve, dbArr, golden, err, data) {
    let lines = data.split("\r\n").slice(1);
    let cardArr = [];

    for (let i = 0, n = lines.length; i < n; i++) {
        let cols = lines[i].split(",");
        let cardName = cols[0];
        let count = parseInt(cols[1]);
        let normalCount = golden ? 0 : count;
        let goldenCount = golden ? count : 0;

        if (cardName.length > 0 && count > 0) {
            let card = dbArr.find(card => card.name === cardName);

            if (card) {
                cardArr.push({
                    id: card.id,
                    normalCount: normalCount,
                    goldenCount: goldenCount
                });
            } else {
                console.log(`Could not find card "${cardName}".`);
            }
        }
    }

    resolve(cardArr);
}

function mergeCardCollections(normalCards, goldenCards) {
    let masterCardCollection = normalCards.slice();

    for (let i = 0, n = goldenCards.length; i < n; i++) {
        let goldenCard = goldenCards[i];
        let cardInNormalArr = normalCards.find(card => card.id === goldenCard.id);

        if (cardInNormalArr) {
            cardInNormalArr.goldenCount += goldenCard.goldenCount;
        } else {
            masterCardCollection.push({
                id: goldenCard.id,
                normalCount: 0,
                goldenCount: goldenCard.goldenCount
            });
        }
    }

    return masterCardCollection;
};

function getInsertsAndUpdatesArr(curCollection, inputCollection) {
    let retArr = [[], []];

    for (let i = 0, n = inputCollection.length; i < n; i++) {
        let inputCard = inputCollection[i];
        let cardInCurCollection = curCollection.find(card => inputCard.id === card.card_id);

        if (cardInCurCollection) {
            if (cardInCurCollection.normal_count !== inputCard.normalCount || cardInCurCollection.golden_count !== inputCard.goldenCount) {
                retArr[1].push(inputCard);
            }
        } else {
            retArr[0].push(inputCard);
        }
    }

    return retArr;
};
