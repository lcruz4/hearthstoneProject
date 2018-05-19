const fs = require("fs");
const db = require("./db.js");
const startup = require("./startup.js");
const CARDCOLLECTIONSTABLE = db.CARDCOLLECTIONSTABLE;
const setTrans = {
    BRM: "Blackrock Mountain",
    CORE: "Basic/Free",
    EXPERT1: "Expert",
    GANGS: "Mean Streets of Gadgetzan",
    GILNEAS: "The Witchwood",
    GVG: "Goblins vs. Gnomes",
    HERO_SKINS: "Hero",
    HOF: "Hall of Fame",
    ICECROWN: "Knights of the Frozen Throne",
    KARA: "One Night in Karazhan",
    LOE: "League of Explorers",
    LOOTAPALOOZA: "Kobolds & Catacombs",
    NAXX: "Curse of Naxxramas",
    OG: "Whispers of the Old Gods",
    TGT: "The Grand Tournament",
    UNGORO: "Journey to Un'Goro"
};

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
        let insertLen = insertsArr.length;
        let updateLen = updatesArr.length;
        let insertPlural = insertLen > 1;
        let updatePlural = updateLen > 1;

        if (insertLen === 0 && updateLen === 0) {
            console.log(`${username}'s collection is up to date.`);
        }
        if (insertLen > 0) {
            console.log(`Inserting ${insertLen} card${insertPlural ? "s" : ""} into ${username}'s collection.\n`);
            db.insertCardCollection(username, insertsArr).then(reportSuccessfulInsert.bind(null, {
                insertLen: insertLen,
                insertPlural: insertPlural,
                insertsArr: insertsArr,
                cardsArr: cardsArr
            })); 
        }
        if (updateLen > 0) {
            console.log(`Updating ${updateLen} card${updateLen > 1 ? "s" : ""} in ${username}'s collection.\n`);
            db.updateCardCollection(username, updatesArr).then(reportSuccessfulUpdate.bind(null, {
                insertLen: insertLen,
                updateLen: updateLen,
                updatePlural: updatePlural,
                updatesArr: updatesArr,
                cardsArr: cardsArr,
                collCards: queryResponse.rows
            })); 
        }


    });
}

function handleReadNormalFile(resolve, dbArr, golden, err, data) {
    let lines = data && data.split("\r\n").slice(1) || [];
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

function reportSuccessfulInsert(args) {
    let insertLen = args.insertLen;
    let insertPlural = args.insertPlural;
    let insertsArr = args.insertsArr;
    let cardsArr = args.cardsArr;
    let msgArr = [];

    console.log(`The following ${insertLen} new card${insertPlural ? "s" : ""} ${insertPlural ? "were" : "was"} successfully inserted:\n`);
    for (let i = 0; i < insertLen; i++) {
        let cardColl = insertsArr[i];
        let normalCount = cardColl.normalCount;
        let goldenCount = cardColl.goldenCount;
        let totalCount = normalCount + goldenCount;
        let card = cardsArr.find(card => card.id === cardColl.id);
        let statsArr = [
            `${card.name}`,
            `mana: ${card.cost}`,
            ...(card.attack == null ? [] : [`attack: ${card.attack}`]),
            ...(card.health == null ? [] : [`health: ${card.health}`]),
            `rarity: ${card.rarity}`,
            `class: ${card.cardClass}`,
            `set: ${setTrans[card.set]}`,
            `text: ${card.text}`
        ];

        msgArr.push(statsArr.join("\n\t"));
    }

    console.log(msgArr.join("\n\n"));
}

function reportSuccessfulUpdate(args) {
    let insertLen = args.insertLen;
    let updateLen = args.updateLen;
    let updatePlural = args.updatePlural;
    let updatesArr = args.updatesArr;
    let cardsArr = args.cardsArr;
    let collCards = args.collCards;
    let msgArr = [];

    console.log(`${insertLen > 0 ? "\n\n" : ""}The following ${updateLen} card count${updatePlural ? "s" : ""} ${updatePlural ? "have" : "has"} been updated:\n`);
    for (let i = 0; i < updateLen; i++) {
        let card = updatesArr[i];
        let name = cardsArr.find(cardDef => cardDef.id === card.id).name;
        let oldCard = collCards.find(cardFromColl => cardFromColl.card_id === card.id);
        let statsArr = [
            name,
            ...(oldCard.normal_count !== card.normalCount ? [`count: ${oldCard.normal_count} -> ${card.normalCount}`] : []),
            ...(oldCard.golden_count !== card.goldenCount ? [`golden: ${oldCard.golden_count} -> ${card.goldenCount}`] : [])
        ];

        msgArr.push(statsArr.join("\n\t"));
    }

    console.log(msgArr.join("\n\n"));
}
