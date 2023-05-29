function doGet() {
  const favicon =
    "https://raw.githubusercontent.com/ymuichiro/symbol_japan_forum/main/logo/cc_0/favicon.ico";
  return HtmlService.createTemplateFromFile("index")
    .evaluate()
    .setTitle("Symbol Harvest Notify")
    .setFaviconUrl(favicon)
    .addMetaTag("apple-mobile-web-app-capable", "yes")
    .addMetaTag("mobile-web-app-capable", "yes")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .addMetaTag("twitter:card", "summary_large_image")
    .addMetaTag("twitter:site", "@faunsu19000")
    .addMetaTag(
      "description",
      "Symbol のハーベスト通知を Gmail で受け取る事ができます"
    )
    .addMetaTag(
      "twitter:description",
      "Symbol のハーベスト通知を Gmail で受け取る事ができます"
    )
    .addMetaTag(
      "twitter:image",
      "https://github.com/ymuichiro/symbol_japan_forum/blob/main/logo/cc_0/twitter-card.png?raw=true"
    );
}

function startSubscribe(address) {
  const node = "https://symbolnode.blockchain-authn.app:3001";
  if (!address) {
    console.error("アドレスが入力されていません", address);
    throw new Error();
  }
  setTrigger(address);
  writeDatabase(getHarvestHistory(address, node));
}

function runRepeat() {
  const node = "https://symbolnode.blockchain-authn.app:3001";
  const property = PropertiesService.getUserProperties();
  const address = property.getProperty("address");
  if (!address) {
    console.error("アドレスが登録されていません", address);
    throw new Error();
  }
  writeDatabase(getHarvestHistory(address, node));
}

function isRegistred() {
  const database = PropertiesService.getUserProperties();
  const triggerStatus = database.getProperty("trigger");
  return triggerStatus === null ? false : true;
}

function deleteAllMyCurrentProperty() {
  const props = PropertiesService.getUserProperties();
  props.deleteAllProperties();
}

function getCurrentUserEmail() {
  return Session.getActiveUser().getEmail();
}

/**
 * Address を 48桁形式に変換する
 * @param {string} address plain 形式のアドレス
 * @param {string} node node の URL
 */
function getEncodeAddress(address, node) {
  const url = [node, "accounts", address].join("/");
  const res = UrlFetchApp.fetch(url);
  return JSON.parse(res.getContentText()).account.address;
}

/**
 * トランザクション履歴よりハーベスト履歴のみ取得する。ページネーションは１ページ目のみとする
 * @param {string} address plain 形式のアドレス
 * @param {string} node node の URL
 */
function getHarvestHistory(address, node) {
  const HARVEST_FEE_ENUM = 8515;
  const url = [node, "statements", "transaction"].join("/");
  const encodedAddress = getEncodeAddress(address, node);
  const res = UrlFetchApp.fetch(`${url}?targetAddress=${address}&order=desc`);
  const data = JSON.parse(res.getContentText()).data;
  let harvestHistory = [];
  data.forEach((d) => {
    d.statement.receipts.forEach((r) => {
      if (r.type === HARVEST_FEE_ENUM && r.targetAddress === encodedAddress) {
        r.targetAddress = address;
        r.amount = Number(r.amount) / 1000000;
        harvestHistory.push({ height: d.statement.height, ...r });
      }
    });
  });
  return harvestHistory;
}

/**
 * 取得結果をデータベースへ格納し、新たなデータがあればユーザーへ通知する
 */
function writeDatabase(data) {
  const database = PropertiesService.getUserProperties();
  let oldData = database.getProperty("data");
  if (!oldData) {
    database.setProperty("data", JSON.stringify([]));
    oldData = [];
  } else {
    oldData = JSON.parse(oldData);
  }

  data.forEach((d) => {
    if (oldData.every((o) => o !== d.height)) {
      oldData.push(d.height);

      GmailApp.sendEmail(
        Session.getActiveUser(),
        "[Notice] Symbol Harvested.",
        "Not supported by this mail software",
        {
          htmlBody: `
            <h1 style="font-size: 1.2em;padding: 0.25em 0.5em;color: #494949;background: transparent;border-left: solid 5px #7db4e6;margin-bottom: 40px;">
              Harvest Info
            </h1>
            <table style="border-spacing: 10px 30px;">
              <tr><td>Height</td><td>${d.height}</td></tr>
              <tr><td>Address</td><td>${d.targetAddress}</td></tr>
              <tr><td>Amount</td><td>${d.amount}</td></tr>
            </table>
            <div
              style="margin-top: 40px;background-color: rgb(234, 234, 234);padding: 10px 10px 10px 10px;">
              <p style="font-size: 0.9em">For more information about us, please visit the <a href="https://symbol-community">Symbol Community Web</a>.<br /> If you wish to unsubscribe from this e-mail, please do so at <a href="https://symbol-community">unsubscribe</a>.</p>
            </div>
          `,
        }
      );
    }
  });

  database.setProperty(
    "data",
    JSON.stringify(oldData.sort((a, b) => b - a).slice(0, 100))
  );
}

/** 定期実行をGASに対して設定する */
function setTrigger(address) {
  const database = PropertiesService.getUserProperties();
  const triggerStatus = database.getProperty("trigger");
  if (!triggerStatus) {
    const id = ScriptApp.newTrigger("runRepeat")
      .timeBased()
      .everyMinutes(30)
      .create();
    database.setProperty("trigger", id.getUniqueId());
    database.setProperty("address", address);
  }
}

function stop() {
  const database = PropertiesService.getUserProperties();
  const triggerStatus = database.getProperty("trigger");
  if (triggerStatus) {
    const trigger = ScriptApp.getProjectTriggers().find(
      (e) => e.getUniqueId() === triggerStatus
    );
    if (trigger) {
      ScriptApp.deleteTrigger(trigger);
    }
    database.deleteProperty("trigger");
    database.deleteProperty("address");
  }
}
