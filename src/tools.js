function getCurrentProperty() {
  const props = PropertiesService.getUserProperties();
  console.log(props.getProperty("address"));
  console.log(props.getProperty("trigger"));
}

function deleteAllMyTrigger() {
  ScriptApp.getProjectTriggers().forEach((e) => {
    ScriptApp.deleteTrigger(e);
  });
}

function deleteAllMyCurrentProperty() {
  const props = PropertiesService.getUserProperties();
  props.deleteAllProperties();
}
