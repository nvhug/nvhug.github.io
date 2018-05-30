const dbProduction = "nvhung-db";
const dbDev = "nvhung-db-dev";

var dbName = "";
if(document.domain === "localhost") {
	dbName = dbDev;
}else {
	dbName = dbProduction;
}

export { dbName };