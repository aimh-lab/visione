
var cells = 49;
var widthCanvas = 380;
var heightCanvas= 216;

CELL_COLS = 7;
CELL_ROWS = 7;

var cellWidth = widthCanvas / CELL_COLS;
var cellHeight = heightCanvas /CELL_ROWS;

var availableTags = null;
var mifileAnnotations = null;

var rect, isDrawing = false, origX, origY, textVal, activeObj, overObj;
//var canvas;
var submitQuery='';
var lastQuery0='';
var lastQuery1='';

var draggedLabel = '';
var isDragging = false;
var lastAnnotation = ['', ''];
var lastTERN = ['', ''];
var lastNotField =  ['', ''];
var lastCanvasObjects =  ['', ''];
var isCanvasClean = [false, false];
var isReset = false;


var canvases;
//var annotations = ['', '']
//var notFields = ['', '']
var lastis43 = false;
var lastis169 = false;
var lastisColor = [false, false];
var lastisGray =[false, false];
var lastGrouped=false;

var results = null;
var resultsSortedByVideo = null;
var isGray = [false, false];
var isColor = [false, false];
var occur = 'and';
var simreorder = false;
var ssr = false;

//var qbeUrl = ''
var is43 = false;
var is169 = false;
var admin= true;

var urlBSService ='' ;
var thumbnailUrl ='' ;
var keyFramesUrl ='';
var activeCanvasIdx = 0;
var activeCanvas = "";
var isCanvasEnabled = [true, true];
var lastIsCanvasEnabled = [true, true];
var lastSimreorder = false;
var lastOccur="and";
var lastQBE="";

const avsMap = new Map();
const avsMapHistory = new Map();
const avsQueryLog = new Map();

var QUERY_SPLIT = '###';


function handler() {
	  if (this.readyState == 4 && this.status == 200) {
		  console.log(this.responseText)
	    var myObj = JSON.parse(this.responseText);
		  urlBSService = myObj.serviceUrl;
		  thumbnailUrl= myObj.thumbnailUrl;
		  keyFramesUrl=myObj.keyFramesUrl;
		  videoUrl=myObj.videoUrl;
	  }
	  
	};
	
	
var client  = new XMLHttpRequest();
client.onload = handler;
client.open("GET", "js/conf.json", false);
client.send(); 

function playVideo(id) {
	alert(id);
	alert(getTimestamp(id + ".png"));
}

function split(val) {
	return val.split(" ");
}

function extractLast(term) {
	return split(term).pop();
}

$.get('yolovarifocalnetstags_with_statistics.txt', function(data) {
	availableTags = data.split("\n");
});

$.get('mifilevbs_with_statistics.txt', function(data) {
	mifileAnnotations = data.split("\n");
});

draggedLabel = '';

function drag(ev) {
	ev.dataTransfer.setData("text", ev.target.id);
	console.log("drag " + ev.target.title);
	draggedLabel = ev.target.title;
}

function getText(id, field) {
	return $
			.ajax({
				type : "GET",
				url :  urlBSService+"/getText?id="+ id + "&field=" + field,
				async : false
			}).responseText
}

function getTimestamp(id) {
	return $
			.ajax({
				type : "GET",
				url :  urlBSService+"/getTimestamp?id="+ id,
				async : false
			}).responseText
}

function submitWithAlert(id, query) {
	if (confirm('Are you sure you want to submit?')) {
		res = commitResult(id, query);
		console.log(res);
		alert('Server response: ' + res);
	}
}

function startNewSession() {
	if (confirm('Are you sure you want to start a new session?')) {
		location.reload();
		$.ajax({
			type : "GET",
			async : false,
			url : urlBSService+"/init"
		}).responseText
	}
}

function submitAVS() {
	if (confirm('Are you sure you want to submit AVS Images?')) {
		for (let pair of avsMap) {
	    	var [keyframeId, id] = pair;
			res = commitResultAVS(keyframeId, avsQueryLog.get(keyframeId));
			console.log(res);
	
			avsRemoveItem(id, keyframeId, false);
			avsMapHistory.set(keyframeId, id);
		}
		updateAvsTitle();
	}
}

function commitResultAVS(id, queries) {
	return $.ajax({
		type : "GET",
		async : true,
		url : urlBSService+"/commitResult?id="+ id + "&isAVS=true&query=" + encodeURIComponent(queries[0]) + "&query2=" + encodeURIComponent(queries[1]) + "&occur=" + occur + "&simreorder=" + simreorder,
	}).responseText;
}


function commitResult(id, query) {
	return $.ajax({
		type : "GET",
		async : false,
		url : urlBSService+"/commitResult?id="+ id+ "&query=" + query,
	}).responseText;
}

function log(query) {
	return $.ajax({
		type : "GET",
		async : false,
		url : urlBSService+"/log?query=" + query,
	}).responseText;
}


/*
 * function getTerms(term) { return $ .ajax({ type : "GET", crossDomain : true,
 * url :
 * "http://virserv101.isti.cnr.it/MIRService/webresources/services/autocompleteTerm?term=" +
 * term, async : false }).responseText }
 */
function addDeleteBtn(label, rect) {
	var id = rect.get('uuid');

	var x = rect.aCoords.tr.x;
	var y = rect.aCoords.tr.y;
	var left = rect.left;

	if (rect.group) {
		var point = rect.getCenterPoint();
		x = rect.group.left;
		y = rect.group.top;
		left = rect.group.left;
	}

	var btnLeft = x - 3;
	var btnTop = y - 9;
	var labelLeft = rect.left;
	var labelTop = y - 30;

	var deleteBtn = '<div id="'
			+ id
			+ '" title="'
			+ label
			+ '"><span style="color: DarkSlateGray; font-size: 1.3em; position:absolute;top:'
			+ labelTop
			+ 'px;left:'
			+ labelLeft
			+ 'px;">'
			+ label
			+ '</span><img id="'
			+ id
			+ '" src="Actions-dialog-close-icon.png" class="deleteBtn" style="position:absolute;top:'
			+ btnTop + 'px;left:' + btnLeft
			+ 'px;cursor:pointer;width:16px;height:16px;"/></div>';
	$(".canvas-container").eq(activeCanvasIdx).append(deleteBtn);}


function cell2Text(idx) {
	if (!isCanvasEnabled[idx])
		return "";
	/*if (!isClean) {
		lastAnnotation[idx] = $("#annotations" + idx).val();
		lastTERN[idx] = $("#tern" + idx).val();
		canvasObjects = canvases[idx].getObjects();
		lastNotField[idx] = $("#not" + idx).val();
	}*/
	is43 = $("#is43").is(":checked");
	is169 = $("#is169").is(":checked");
	isColor[idx] = $("#isColor" + idx).is(":checked");
	isGray[idx] = $("#isGray" + idx).is(":checked");
	occur = $('input[name="occur"]:checked').val();
	simreorder = $("#simreorder").is(":checked");


	objects = '';
	txt = '';
	query = '';
	labelCounter = [];
	colors = [];
	
	spatialObjects = '';
	commaDetectedObj = "";
	canvases[idx].getObjects().forEach(
			function(o) {
				if (o.get('type') == 'rect') {
					if (o && o.oCoords) {
						startCol = Math.floor(Math.max(0, o.oCoords.tl.x)
								/ cellWidth);
						endCol = Math.ceil(Math.min(widthCanvas, o.oCoords.tr.x)
								/ cellWidth);	resultsSortedByVideo = '';


						startRow = Math.floor(Math.max(0, o.oCoords.tr.y)
								/ cellHeight);
						endRow = Math.ceil(Math.min(heightCanvas, o.oCoords.br.y)
								/ cellHeight);
					} else {
						startCol = Math.floor(Math.max(0, o.left) / cellWidth);
						endCol = Math.ceil(Math.min(widthCanvas, (o.left + o.width))
								/ cellWidth);

						startRow = Math.floor(Math.max(0, o.top) / cellHeight);
						endRow = Math.ceil(Math.min(heightCanvas, (o.top + o.height))
								/ cellHeight);
					}
					label = $("#" + o.uuid).attr('title').trim();
					if (label.search(" ") != -1) {
						label = '(4wc'
								+ label
										.replace(new RegExp(" ", "g"),
												" OR 4wc") + ")";
						console.log("label: " + label);
					}

					if (o.uuid.startsWith('color_')) {
						colors.push(label);
					} else {
						counter = labelCounter[label];
						if (counter == null)
							counter = 1;
						else
							counter++;
						labelCounter[label] = counter;

						objects += label + counter + " ";
					}

					for (row = startRow; row < endRow; row++) {
						for (col = startCol; col < endCol; col++) {
							// txt += col + String.fromCharCode(97 + row) +
							// label + '%5E' + boost + ' ' ;
							txt += row + String.fromCharCode(97 + col) + label
									+ ' ';
						}
					}
					x0 = Math.round(Math.max(0, o.oCoords.tl.x))
					y0 = Math.round(Math.max(0, o.oCoords.tr.y))		
					width = Math.round(Math.min(widthCanvas, o.oCoords.tr.x) - x0);
					height = Math.round(Math.min(heightCanvas, o.oCoords.br.y) - y0);

					spatialObjects += commaDetectedObj + '{"image_id": "query", "bbox": [' + x0 + ',' + y0 + ',' + width + ',' + height + '],"category_id": "' + label + '"}';
					commaDetectedObj = QUERY_SPLIT;
				}
			})
			if (spatialObjects != '') {
				spatialObjects = '{"images": [{"height": ' + heightCanvas + ',"width": ' + widthCanvas + ',"id": "query"}], "annotations": [' + spatialObjects;
				spatialObjects += ']}';
				spatialObjects = "___" + spatialObjects;


			}
	// console.log(colors);
	// console.log(objects);
	console.log(colors);
	for (cIdx = 0; cIdx < colors.length; cIdx++) {
		objects += colors[cIdx] + " ";
	}
	
	if (isGray[idx]) {
		objects += "graykeyframe ";
	} else 	if (isColor[idx]) {
		objects += "colorkeyframe ";
	}
	
	if (is43) {
		objects += "ratio43 ";
	} else 	if (is169) {
		objects += "ratio169 ";
	}
	
	comma = ''
	annotations = $("#annotations" + idx).val().trim().replace(/[^\x21-\x7E]+/g, ' ');
	tern = $("#tern" + idx).val().trim().replace(/[^\x21-\x7E]+/g, ' ');


	notField = $("#not" + idx).val().trim().replace(/[^\x21-\x7E]+/g, ' ');
	if (notField != '') {
		items = notField.split(" ");
		parsedField = '';
		for (i = 0; i < items.length; i++) {
			if (!isNaN(items[i])) {
				freq = Math.max((+items[i] + 1), 0);
				i++;
				parsedField += items[i] + freq + " ";
			} else
				parsedField += items[i] + " ";
		}
		notField = parsedField.trim();
		notField = notField.replace(new RegExp(" ", "g"), ' -4wc');
		notField = '-4wc' + notField;
	}

	if (objects != '') {
		groups = '';
		console.log(objects.match('\\((.*?)\\)'));
		if ((group = objects.match('\\((.*?)\\)'))) {
			objects = objects.replace("\\(" + group[1] + "\\)", '');
			console.log("objects: " + objects);
			groups += group;
		}

		// console.log(a.match('\\((.*?)\\)')[1]);
		// console.log(a.replace(new RegExp("\\((.*?)\\)", "g"), ''));

		objects = "objects" + QUERY_SPLIT + "4wc"
				+ objects.trim().replace(new RegExp(" ", "g"), " 4wc");
		// or queries disabled
		// objects += groups;
	} else if (notField != '') {
		objects = "objects" + QUERY_SPLIT + "4wc*";
	}
	objects += notField;

	if (objects != '') {
		query += comma;
		query += objects;
		comma = QUERY_SPLIT;
	}
	
	if (tern != '') {
		query += comma;
		tern = "tern" + QUERY_SPLIT + tern;
		query += tern;
		comma = QUERY_SPLIT;
	}

	if (annotations != '') {
		query += comma;
		annotations = "mifile" + QUERY_SPLIT + annotations;
		query += annotations;
		comma = QUERY_SPLIT;
	}

	if (txt != '') {
		query += comma;
		txt = "txt" + QUERY_SPLIT + txt;
		query += txt;
		comma = QUERY_SPLIT;
	}

	console.log("Query " +query.length);
	//submitQuery = query;
	//if(query.length > 0)search(query);
//	else $("#imgtable").remove();
	//return query + spatialObjects;
	return query;
}

function timestamp() {
	time = Math.floor(new Date() / 1000);
	console.log(" DATE " + time);
	return ;
}

function performSearch(query) {
	lastQuery0 = query;
	submitQuery = query;
	if(query.length > 0)search(query);
	else $("#imgtable").remove();
}

function performSearch2(query, query2) {
	lastQuery0 = query;
	lastQuery1 = query2;

	submitQuery = query;
	if(query.length > 0 || query2.length > 0)
		search2(query, query2);
	else 
		$("#imgtable").remove();
}
/*
function search(query) {
	$.ajax({
		type : "GET",
		dataType : "text",
		url : urlBSService+"/search?query="+ query +"&occur="+occur +"&simreorder="+simreorder,
		success : function(data) {
			results = data;
			sortByVideo(data);
			groupResults(document.getElementById("group"));
			 // history.pushState(JSON.stringify($(this)),'List',window.location.href);
		},
		error : function(data) {
			$("#imgtable").remove();
		}
	});
}
*/
/*
function search2(query, query2) {
	$.ajax({
		type : "GET",
		dataType : "text",
		url : urlBSService+"/search?query="+ query + "&query2=" + query2,
		success : function(data) {
			results = data;
			sortByVideo(data);
			groupResults(document.getElementById("group"));
			 // history.pushState(JSON.stringify($(this)),'List',window.location.href);
		},
		error : function(data) {
			$("#imgtable").remove();
		}
	});
}

function search(query) {
	$.ajax({
		type : "GET",
		dataType : "text",
		url : urlBSService+"/search?query="+ query,
		success : function(data) {
			results = data;
			sortByVideo(data);
			groupResults(document.getElementById("group"));
			 // history.pushState(JSON.stringify($(this)),'List',window.location.href);
		},
		error : function(data) {
			$("#imgtable").remove();
		}
	});
}
*/

function search2(query, query2) {
	values = query.split("___");
	values2 = query2.split("___");
	ssrQuery = "";
	if (ssr)
		ssrQuery =  values[1]

	$.ajax({
		type : "POST",
		data: {query: values[0], query2: values2[0], occur: occur, simreorder: simreorder, ssr: ssrQuery},
		dataType : "text",
		url : urlBSService+"/search",
		success : function(data) {
			results = data;
			sortByVideo(data);
			groupResults(document.getElementById("group"));
			 // history.pushState(JSON.stringify($(this)),'List',window.location.href);
		},
		error : function(data) {
			$("#imgtable").remove();
		}
	});
}

function search(query) {
	values = query.split("___");
ssrQuery = "";
	if (ssr)
		ssrQuery =  values[1]
	$.ajax({
		type : "POST",
		data: {query: values[0], occur: occur, simreorder: simreorder, ssr: ssrQuery},
		dataType : "text",
		url : urlBSService+"/search",
		success : function(data) {
			results = data;
			sortByVideo(data);
			groupResults(document.getElementById("group"));
			 // history.pushState(JSON.stringify($(this)),'List',window.location.href);
		},
		error : function(data) {
			$("#imgtable").remove();
		}
	});
}

function searchBySSR(query) {
	$.ajax({
		type : "POST",
		data: {query: query},
		dataType : "text",
		url : urlBSService+"/search",
		success : function(data) {
			results = data;
			sortByVideo(data);
			groupResults(document.getElementById("group"));
			 // history.pushState(JSON.stringify($(this)),'List',window.location.href);
		},
		error : function(data) {
			$("#imgtable").remove();
		}
	});
}

function searchByTERNSimilarity(query) {
	$.ajax({
		type : "POST",
		data: {query: query},
		dataType : "text",
		url : urlBSService+"/search",
		success : function(data) {
			results = data;
			sortByVideo(data);
			groupResults(document.getElementById("group"));
			 // history.pushState(JSON.stringify($(this)),'List',window.location.href);
		},
		error : function(data) {
			$("#imgtable").remove();
		}
	});
}

function sortByVideo(data) {
	resultsSortedByVideo = '';
	console.log("Sort By Video "+data.length);
	if(data.length != 0){
	dataDict = {};
	
	res = data.trim().split(" ");
	keys = [];
	
	for (i = 0; i < res.length; i += 2) {
			resValues = res[i + 1].split("/");
			videoID = resValues[0];
			idHref = resValues[1].split("\.")[0];
		value = dataDict[videoID];
		if (value == null) {
			value = '';
			keys[keys.length] = videoID;
		}
		value += res[i] + ' ' + res[i + 1] + ' ';
		// console.log(res[i] + ' ' + res[i + 1] + ' ');
		dataDict[videoID] = value;
	}
	// console.log(keys);
	for (i = 0; i < keys.length; i++) {
		// console.log(i + " " + dataDict[keys[i]]);
		resultsSortedByVideo += dataDict[keys[i]];
	}
	}
	return resultsSortedByVideo;
}

function groupResults(checkbox) {
	if(checkBox = document.getElementById("group").checked) {
		showResults(resultsSortedByVideo);
		log("explicitsort2" + QUERY_SPLIT + "groupByVideo");

	}
	else {
		showResults(results);
		log("rankedlist" + QUERY_SPLIT + "rankedList")
	}
}

function setGray(checkboxId) {
	if(checkBox = document.getElementById("isGray" + checkboxId).checked) {
		isGray[checkboxId] = true;
		document.getElementById("isColor" + checkboxId).checked = false;
		isColor[checkboxId] = false;
	}
	else
		isGray[checkboxId] = false;
	//cell2Text();
	query1 = cell2Text(0);
	query2 = cell2Text(1);
			
	performSearch2(query1, query2);
}

function setOccur(radioButton) {
	occur = $('input[name="occur"]:checked').val();
	console.log(occur);

	query1 = cell2Text(0);
	query2 = cell2Text(1)
	performSearch2(query1, query2);
}

function enableCanvas(canvasId) {
	 document.getElementById("overlay" + canvasId).style.display = "none";
	isCanvasEnabled[canvasId] = true
}

function disableCanvas(canvasId) {
	document.getElementById("overlay" + canvasId).style.display = "block";
	isCanvasEnabled[canvasId] = false

}

function setCanvasState(canvasId, radioButton) {
	canvas0State = $('input[name="canvas0"]:checked').val();
	canvas1State = $('input[name="canvas1"]:checked').val();
	if (canvas0State == "enabled") {
		enableCanvas(0);
	} else {
		disableCanvas(0);
	}
	
	if (canvas1State == "enabled") {
		enableCanvas(1);
	} else {
		disableCanvas(1);
	}
	performSearch2(cell2Text(0), cell2Text(1));
}

function setSimReorder(checkbox) {
	if(checkBox = document.getElementById("simreorder").checked)
		simreorder = true;
	else
		simreorder = false;
}

function setSSR(checkbox) {
	if(checkBox = document.getElementById("ssr").checked)
		ssr = true;
	else
		ssr = false;
	
	query1 = cell2Text(0);
	query2 = cell2Text(1)
	performSearch2(query1, query2);
}

function setColor(checkboxId) {
	if(checkBox = document.getElementById("isColor" + checkboxId).checked) {
		isColor[checkboxId] = true;
		document.getElementById("isGray" + checkboxId).checked = false;
		isGray[checkboxId] = false;
		
	}
	else 
		isColor[checkboxId] = false;
	query1 = cell2Text(0);
	query2 = cell2Text(1);
			
	performSearch2(query1, query2);
}

function set43(checkbox) {
	if(checkBox = document.getElementById("is43").checked) {
		is43 = true;
		document.getElementById("is169").checked = false;
		is169 = false;
	}
	else
		is43 = false;
	query1 = cell2Text(0);
	query2 = cell2Text(1);
			
	performSearch2(query1, query2);
}

function set169(checkbox) {
	if(checkBox = document.getElementById("is169").checked) {
		is169 = true;
		document.getElementById("is43").checked = false;
		is43 = false;

	}
	else 
		is169 = false;
	query1 = cell2Text(0);
	query2 = cell2Text(1);
			
	performSearch2(query1, query2);
}

function queryByExample(imgUrl) {
	query1 = "qbe" + QUERY_SPLIT + imgUrl;
	query2 = "";
			
	performSearch2(query1, query2);
}

function queryByTERN(ternText0, ternText1) {
	/*query1 = "";
	query2 = "";
	if (ternText0.trim() != "")
		query1 = "tern," + ternText0.trim();
	if (ternText1.trim() != "")
		query2 = "tern," + ternText1.trim();
			
	performSearch2(query1, query2);
	*/
			
	performSearch2(cell2Text(0), cell2Text(1));
}

function fromIDtoColor(id, numberborderColors){ // FRANCA
	var idH= id.hashCode();
	borderColorsIdx = idH % numberborderColors;
	return borderColorsIdx;
}


String.prototype.hashCode = function(){// FRANCA
	var hash = 0;
	if (this.length == 0) return hash;
	for (j = 0; j < this.length; j++) {
		char = this.charCodeAt(j);
		hash = ((hash<<5)-hash)+char;
		hash = hash & hash; 
	}
	return hash;
}

function avs(id, url, keyframeId) {
	if (avsMapHistory.has(keyframeId)) {
		$('#' + id).prop('checked', true);
		return;
	}
	$("#avsTitle").remove();
	if ($("#" + id).is(":checked")) {
		img = '<div id="avsList_' + id + '"><div style="color:green;">' + id.substring(8) + '</div>';
		img += '<img title="' + keyframeId + '"style="padding-bottom: 10px;" width="128" src="' + url + '">';
		img += '<img title="remove ' + keyframeId + '" width="24" style="vertical-align: top;" src="Actions-dialog-close-icon.png" onclick="avsRemoveItem(\'' + id + '\', \'' + keyframeId + '\', true); updateAvsTitle()"/></div>'
		avsMap.set(keyframeId, id);
		avsQueryLog.set(keyframeId, [lastQuery0, lastQuery1]);
		$("#avsTab").append(img);
		
	} else {
		avsRemoveItem(id, keyframeId, true)
	}
	updateAvsTitle();
	console.log(avsMap);
}

function avsRemoveItem(id, keyframeId, uncheck) {
	$("#avsTitle").remove();
	$("#avsList_" + id).remove();

	avsMap.delete(keyframeId);
	if (uncheck)
		$('#' + id).prop('checked', false);		
}

function updateAvsTitle() {
	avsText = "";
	if (avsMap.size > 0 || avsMapHistory.size > 0) {
		avsText = '<div title="Selected images for AVS Tasks" id="avsTitle"><span style="color:brown; font-size: larger;">Selected: <b style="color: Coral; font-size:large;">' + avsMap.size + '</b></span><span style="color:green; font-size: larger;"> Submitted: <b style="color: red; font-size:large;">' + avsMapHistory.size + '</b></span>';
	}
	if (avsMap.size > 0) {
		avsText += '<span class="pull-right"><i title="Submit AVS image List" class="fa fa-arrow-alt-circle-up" style="font-size:36px; float: right; color:#00AA00; padding-left: 0px;" onclick="submitAVS(); return false;"></i></span></div>';
	}
	if (avsMap.size > 0 || avsMapHistory.size > 0) {
		$("#avsTab").prepend(avsText);	
	}
}

function avsSelectedCheckbox() {
	for (let pair of avsMap) {
    	var [key, value] = pair;
		$('#' + value).prop('checked', true);
	}
	
	for (let pair of avsMapHistory) {
    	var [key, value] = pair;
		$('#' + value).prop('checked', true);
	}

}

function showResults(data) {
	$('html,body').scrollTop(0);
	$("#imgtable").remove();
	res = data.trim().split(" ");
	//patch temporanea 20/07/20 per il merge
	if (res.length > 1200)
		res = res.slice(0, 1200);
	if(data.length == 0 )
	{
		imgtable = '<div id="imgtable" class="alert alert-danger" role="alert"> <strong>Ops!</strong> No results.';
	}else{
		borderColors = ["#63b598", "#ce7d78", "#ea9e70", "#a48a9e", "#c6e1e8", "#648177" ,"#0d5ac1" ,
	"#f205e6" ,"#1c0365" ,"#14a9ad" ,"#4ca2f9" ,"#a4e43f" ,"#d298e2" ,"#6119d0",
	"#d2737d" ,"#c0a43c" ,"#f2510e" ,"#651be6" ,"#79806e" ,"#61da5e" ,"#cd2f00" ,
	"#9348af" ,"#01ac53" ,"#c5a4fb" ,"#996635","#b11573" ,"#4bb473" ,"#75d89e" ,
	"#2f3f94" ,"#2f7b99" ,"#da967d" ,"#34891f" ,"#b0d87b" ,"#ca4751" ,"#7e50a8" ,
	"#c4d647" ,"#e0eeb8" ,"#11dec1" ,"#289812" ,"#566ca0" ,"#ffdbe1" ,"#2f1179" ,
	"#935b6d" ,"#916988" ,"#513d98" ,"#aead3a", "#9e6d71", "#4b5bdc", "#0cd36d",
	"#250662", "#cb5bea", "#228916", "#ac3e1b", "#df514a", "#539397", "#880977",
	"#f697c1", "#ba96ce", "#679c9d", "#c6c42c", "#5d2c52", "#48b41b", "#e1cf3b",
	"#5be4f0", "#57c4d8", "#a4d17a", "#225b8", "#be608b", "#96b00c", "#088baf",
	"#f158bf", "#e145ba", "#ee91e3", "#05d371", "#5426e0", "#4834d0", "#802234",
	"#6749e8", "#0971f0", "#8fb413", "#b2b4f0", "#c3c89d", "#c9a941", "#41d158",
	"#fb21a3", "#51aed9", "#5bb32d", "#807fb", "#21538e", "#89d534", "#d36647",
	"#7fb411", "#0023b8", "#3b8c2a", "#986b53", "#f50422", "#983f7a", "#ea24a3",
	"#79352c", "#521250", "#c79ed2", "#d6dd92", "#e33e52", "#b2be57", "#fa06ec",
	"#1bb699", "#6b2e5f", "#64820f", "#1c271", "#21538e", "#89d534", "#d36647",
	"#7fb411", "#0023b8", "#3b8c2a", "#986b53", "#f50422", "#983f7a", "#ea24a3",
	"#79352c", "#521250", "#c79ed2", "#d6dd92", "#e33e52", "#b2be57", "#fa06ec",
	"#1bb699", "#6b2e5f", "#64820f", "#1c271", "#9cb64a", "#996c48", "#9ab9b7",
	"#06e052", "#e3a481", "#0eb621", "#fc458e", "#b2db15", "#aa226d", "#792ed8",
	"#73872a", "#520d3a", "#cefcb8", "#a5b3d9", "#7d1d85", "#c4fd57", "#f1ae16",
	"#8fe22a", "#ef6e3c", "#243eeb", "#1dc18", "#dd93fd", "#3f8473", "#e7dbce",
	"#421f79", "#7a3d93", "#635f6d", "#93f2d7", "#9b5c2a", "#15b9ee", "#0f5997",
	"#409188", "#911e20", "#1350ce", "#10e5b1", "#fff4d7", "#cb2582", "#ce00be",
	"#32d5d6", "#17232", "#608572", "#c79bc2", "#00f87c", "#77772a", "#6995ba",
	"#fc6b57", "#f07815", "#8fd883", "#060e27", "#96e591", "#21d52e", "#d00043",
	"#b47162", "#1ec227", "#4f0f6f", "#1d1d58", "#947002", "#bde052", "#e08c56",
	"#28fcfd", "#bb09b", "#36486a", "#d02e29", "#1ae6db", "#3e464c", "#a84a8f",
	"#911e7e", "#3f16d9", "#0f525f", "#ac7c0a", "#b4c086", "#c9d730", "#30cc49",
	"#3d6751", "#fb4c03", "#640fc1", "#62c03e", "#d3493a", "#88aa0b", "#406df9",
	"#615af0", "#4be47", "#2a3434", "#4a543f", "#79bca0", "#a8b8d4", "#00efd4",
	"#7ad236", "#7260d8", "#1deaa7", "#06f43a", "#823c59", "#e3d94c", "#dc1c06",
	"#f53b2a", "#b46238", "#2dfff6", "#a82b89", "#1a8011", "#436a9f", "#1a806a",
	"#4cf09d", "#c188a2", "#67eb4b", "#b308d3", "#fc7e41", "#af3101", "#ff065",
	"#71b1f4", "#a2f8a5", "#e23dd0", "#d3486d", "#00f7f9", "#474893", "#3cec35",
	"#1c65cb", "#5d1d0c", "#2d7d2a", "#ff3420", "#5cdd87", "#a259a4", "#e4ac44",
	"#1bede6", "#8798a4", "#d7790f", "#b2c24f", "#de73c2", "#d70a9c", "#25b67",
	"#88e9b8", "#c2b0e2", "#86e98f", "#ae90e2", "#1a806b", "#436a9e", "#0ec0ff",
	"#f812b3", "#b17fc9", "#8d6c2f", "#d3277a", "#2ca1ae", "#9685eb", "#8a96c6",
	"#dba2e6", "#76fc1b", "#608fa4", "#20f6ba", "#07d7f6", "#dce77a", "#77ecca"];
	
	borderColorsIdx = 0;
	numberborderColors = borderColors.length;
	imgtable = '<div id="imgtable" style="text-align: left; width: 1050px;">';
	previousID = '';
	
	for (i = 0; i < res.length; i += 2) {
		if (i % 10 == 0){
			if(i == 0)
				imgtable += ' <div class="row myrow" >';
			else 
				imgtable += '</div><div class="row myrow">';
		}
		resSplit = res[i + 1].split("__");
		for (splitIdx = 0; splitIdx < resSplit.length; splitIdx++) {
			path = resSplit[splitIdx]+".jpg";
			alt = resSplit[splitIdx]; 
			resValues = resSplit[splitIdx].split("/");
			videoID = resValues[0];
			idHref = resValues[1].split("\.")[0];
			nameFrame = idHref.split("shot")[1];
			borderColorsIdx = fromIDtoColor(videoID,numberborderColors ); // FRANCA
			previousID = videoID;

			imgtable += '<div class="col mycol">'
				+'<div class="thumbnailButtons">'
				+' <input class="checkboxAvs" id="avs_' + idHref + '" type="checkbox" title="select for AVS Task" onchange="avs(\'avs_' + idHref + '\',\'' + thumbnailUrl+ path + '\',\'' + alt + '\')">&nbsp;'
				+'<a href="indexedData.html?id='+ alt+ '" target="_blank">'+ nameFrame+'</a>'
				+'<a href="showVideoKeyframes.jsp?id='+ alt	+ '#'+ idHref+	'" target="_blank"><i class="fa fa-th" style="padding-left: 5px;"></i></a>'
				+'<i class="fa fa-play" style="color:#007bff;padding-left: 5px;" onclick="playVideoWindow(\''+ videoID+ '\', \''+alt+'\'); return false;"></i>'
				+'<span style="color:blue;" title="' + alt + '" id="ternSim' + idHref + '">TERN </span>'
				//+'<span style="color:blue;" title="' + alt + '" id="ssr' + idHref + '">SSR </span>'
				//+'<span style="color:green;" title="' + alt + '" id="bb' + idHref + '"> BB</span>'
				+'<span class="pull-right"><i title="Submit result" class="fa fa-arrow-alt-circle-up" style="font-size:21px; float: right; color:#00AA00; padding-left: 0px;" onclick="submitWithAlert(\''+ alt+ '\',\''+submitQuery+'\'); return false;"></i></span>'
				+'</div><div class="myimg-thumbnail" style="border-color:' + borderColors[borderColorsIdx] + ';">'
				+'<img class="myimg"   alt="'+ alt+ '" id="'+ idHref+ '" title="Search similar. score: '+ res[i]+ '" src="'+thumbnailUrl+ path + '"/>'
				+'</div></div>'

		}
				
	}
		}
	imgtable += '</div>';
	$("#results").append(imgtable);
	for (i = 0; i < res.length; i += 2) {
		resSplit = res[i + 1].split("__");
		for (splitIdx = 0; splitIdx < resSplit.length; splitIdx++) {
			console.log(res[i + 1]);
			idHref = resSplit[splitIdx].split("/")[1].split("\.")[0];
			console.log(idHref);
					$('#' + idHref).click(function() {
			console.log(this.id);
			search("vf" + QUERY_SPLIT + this.alt);
		});
		
		$('#ternSim' + idHref).click(function() {
			console.log(this.id);
			search("ternSim" + QUERY_SPLIT + this.title);
		});
		}
	}
	avsSelectedCheckbox();

}

function playVideoWindow(videoId, idHref){
  let params = `scrollbars=no,status=no,location=no,toolbar=no,menubar=no,width=600,height=600,left=50,top=50`;
  video = videoId.split(QUERY_SPLIT);
  numTime = idHref;
  console.log("----" +videoId + " "+numTime);
  var timestamp = getTimestamp(numTime);
  log("videoPlayer" + QUERY_SPLIT + videoId + "_" + timestamp);
  input_file = videoUrl +videoId+"/"+videoId+".mp4#t="+timestamp;
  var myWindow = window.open(input_file, "playvideo",params);

}

function generateUUID(color) {
	var d = new Date().getTime();
	if (window.performance && typeof window.performance.now === "function") {
		d += performance.now(); // use high-precision timer if available
	}
	var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,
			function(c) {
				var r = (d + Math.random() * 16) % 16 | 0;
				d = Math.floor(d / 16);
				return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
			});
	if (color)
		uuid = 'color_' + uuid;
	return uuid;
}

		$(document).on('click',".deleteBtn",function(event){
			console.log("active canvas: " + activeCanvasIdx);
			activeCanvas.getObjects().forEach(function(o) {
		        if(o.uuid === event.target.id) {
		        	activeCanvas.discardActiveObject().renderAll();
		        	activeCanvas.remove(o);
		        }
		    })
		    $("#" + event.target.id).remove();
			query1 = cell2Text(0);
			console.log(query1);
			query2 = cell2Text(1);
			console.log(query2);
			performSearch2(query1, query2);
		});

dropImage = function(e) {
	
	activeCanvas = canvas0;
	activeCanvasIdx = 0;
	var pointer = canvas1.getPointer(event.e);
	var posX = pointer.x;
	var posY = pointer.y;
	if ((posX >= 0 && posX <= widthCanvas) && (posY >= 0 && posY <= heightCanvas)) {
		activeCanvas = canvas1;
		activeCanvasIdx = 1;
	}
	
	if (draggedLabel != '') {
		scale = 25;

		var dt = e.originalEvent.dataTransfer, files = dt.files;
		e = e || window.event;
		e.preventDefault();
		e.stopPropagation();
		textVal = e.target.id;

		$('.refs').removeClass('highlight');

		if (e.target.nodeName == "CANVAS") {
			var pointer = activeCanvas.getPointer(e);
			origX = pointer.x;
			origY = pointer.y;
			var imgElement = document.getElementById(draggedLabel);
			color = imgElement.alt == 'color' ? true : false;
			if (color) {
				scale= 18;
			}
			console.log(scale + "------------------ELEMENTO " +imgElement.src)
			
			rect = new fabric.Image(imgElement, {
				left : origX - 25,
				top : origY - 30,
				fill : '',
				stroke : 'black',
				type : 'rect',
				uuid : generateUUID(color),
				strokeWidth : 1,
				scaleX: scale / imgElement.width,
		        scaleY: scale / imgElement.height
			});
			activeCanvas.add(rect);
			activeCanvas.discardActiveObject();

			addDeleteBtn(draggedLabel, rect);
			activeObj = rect;
			rect = null;
			
			isCanvasClean[activeCanvasIdx] = false;
			isReset = false;
			
			query1 = cell2Text(0);
			query2 = cell2Text(1);
			
			performSearch2(query1, query2);
			canvasObjects = activeCanvas.getObjects();
			activeCanvas.on('object:scaling', (e) => {// FRANCA
				var o = e.target;
				if (!o.strokeWidthUnscaled && o.strokeWidth) {
			  	o.strokeWidthUnscaled = o.strokeWidth;
			  }
				if (o.strokeWidthUnscaled) {
			  	o.strokeWidth = o.strokeWidthUnscaled / o.scaleX;
			  }
			});
		}

		isDragging = false;
		draggedLabel = '';
	}
}



function indexedCells(txt) {
	colorMap = {
		'0.png' : 'style="background-color: rgb(0,0,0); color: rgb(255,255,255);"',
		'1.png' : 'style="background-color: rgb(73,60,43); color: rgb(255,255,255);"',
		'2.png' : 'style="background-color: rgb(190,38,51); color: rgb(255,255,255);"',
		'3.png' : 'style="background-color: rgb(224,111,139);"',
		'4.png' : 'style="background-color: rgb(164,100,34); color: rgb(255,255,255);"',
		'5.png' : 'style="background-color: rgb(235,137,49);"',
		'6.png' : 'style="background-color: rgb(247,226,107);"',
		'7.png' : 'style="border: 1px solid grey; background-color: rgb(255,255,255);"',
		'8.png' : 'style="background-color: rgb(157,157,157); color: rgb(255,255,255);"',
		'9.png' : 'style="background-color: rgb(47,72,78); color: rgb(255,255,255);"',
		'10.png' : 'style="background-color: rgb(27,38,50); color: rgb(255,255,255);"',
		'11.png' : 'style="background-color: rgb(68,137,26); color: rgb(255,255,255);"',
		'12.png' : 'style="background-color: rgb(163,206,39);"',
		'13.png' : 'style="background-color: rgb(0,87,132); color: rgb(255,255,255);"',
		'14.png' : 'style="background-color: rgb(49,162,242);"',
		'15.png' : 'style="background-color: rgb(178,220,239);"',
		'16.png' : 'style="background-color: rgb(52,42,151); color: rgb(255,255,255);"',
		'17.png' : 'style="background-color: rgb(101,109,113); color: rgb(255,255,255);"',
		'18.png' : 'style="background-color: rgb(204,204,204);"',
		'19.png' : 'style="background-color: rgb(115,41,48); color: rgb(255,255,255);"',
		'20.png' : 'style="background-color: rgb(203,67,167);"',
		'21.png' : 'style="background-color: rgb(82,79,64); color: rgb(255,255,255);"',
		'22.png' : 'style="background-color: rgb(173,157,51); color: rgb(255,255,255);"',
		'23.png' : 'style="background-color: rgb(236,71,0);"',
		'24.png' : 'style="background-color: rgb(250,180,11);"',
		'25.png' : 'style="background-color: rgb(17,94,51); color: rgb(255,255,255);"',
		'26.png' : 'style="background-color: rgb(20,128,126); color: rgb(255,255,255);"',
		'27.png' : 'style="background-color: rgb(21,194,165);"',
		'28.png' : 'style="background-color: rgb(34,90,246);"',
		'29.png' : 'style="background-color: rgb(153,100,249);"',
		'30.png' : 'style="background-color: rgb(247,142,214);"',
		'31.png' : 'style="background-color: rgb(244,185,144);"',
		'white' : 'style="background-color: white; color: rgb(0,0,0);  border: 1px solid #000;"',
		'black' : 'style="background-color: black; color: rgb(255,255,255);"',
		'blue' : 'style="background-color: blue; color: rgb(255,255,255);"',
		'brown' : 'style="background-color: brown; color: rgb(255,255,255);"',
		'green' : 'style="background-color: green; color: rgb(255,255,255);"',
		'grey' : 'style="background-color: grey; color: rgb(255,255,255);"',
		'orange' : 'style="background-color: orange; color: rgb(255,255,255);"',
		'pink' : 'style="background-color: pink; color: rgb(255,255,255);"',
		'purple' : 'style="background-color: purple; color: rgb(255,255,255);"',
		'red' : 'style="background-color: red; color: rgb(255,255,255);"',
		'yellow' : 'style="background-color: yellow; color: rgb(0,0,0);"'

	};
	console.log("indexedCells " + txt);
	res = txt.trim().split(" ");
	cellTxt = [];
	for (i = 0; i < res.length; i++) {
		txt = '';
		key = res[i].substring(0, 2);
		if (cellTxt[key])
			txt = cellTxt[key];
		style = colorMap[res[i].substring(2)] == null ? '<div>'
				+ res[i].substring(2) + '</div>' : '<div '
				+ colorMap[res[i].substring(2)] + '>' + res[i].substring(2)
				+ '</div>';
		txt += style;
		cellTxt[key] = txt;
		console.log(cellTxt[0]);

	}
	imgtable = '<table id="cellTable" style="width: 825px;">';
	imgtable += '<tr><td align="center"></td><td align="center">a</td><td align="center">b</td><td align="center">c</td><td align="center">d</td><td align="center">e</td>	<td align="center">f</td><td align="center">g</td>';
	counter = 0;
	row = 0;
	for (y = 0; y < CELL_ROWS; y++) {
		for (x = 0; x < CELL_COLS; x++) {
			if (counter % CELL_COLS == 0) {
				imgtable += '<tr>';
				imgtable += '<td style="width: 16px;">' + row++ + '</td>';

			}
			imgtable += '<td valign="top" style="border: 1px solid black; width: 115px;">'
					+ cellTxt[y.toString() + String.fromCharCode(97 + x)]
					+ '</td>';
			counter++;
		}
	}
	imgtable += '</table>'

	$('#txt').append(imgtable);
}

function changeQueryBySampleMod(mode) {
		if (mode == "url") {
			document.getElementById("uploadText").style.display = 'none';
			document.getElementById("uploadLink").style.display = '';
			document.getElementById("urlText").style.display = '';
			document.getElementById("urlLink").style.display = 'none';
			document.getElementById("imageToUpload").style.display = 'none';
			document.getElementById("urlToUpload").style.display = '';
			document.getElementById("imageToUpload").value = '';
			
//			document.getElementById("imageToUpload").type="text";
//			document.getElementById("imageToUpload").name="url";
//			document.getElementById("imageToUpload").size="49";
			
			document.getElementById("searchbar").enctype="";
			document.getElementById("searchbar").method="GET";
			

		} else {
			document.getElementById("uploadText").style.display = '';
			document.getElementById("uploadLink").style.display = 'none';
			document.getElementById("urlText").style.display = 'none';
			document.getElementById("urlLink").style.display = '';
			
			document.getElementById("urlToUpload").style.display = 'none';
			document.getElementById("imageToUpload").style.display = '';
			document.getElementById("urlToUpload").value = '';
			
//			document.getElementById("imageToUpload").type="file";
//			document.getElementById("imageToUpload").name="imgFile";
//			document.getElementById("imageToUpload").size="38";
			
			document.getElementById("searchbar").enctype="multipart/form-data";
			document.getElementById("searchbar").method="POST";
		}
}

function includeHTML() {
  var z, i, elmnt, file, xhttp;
  /* Loop through a collection of all HTML elements: */
  z = document.getElementsByTagName("*");
  for (i = 0; i < z.length; i++) {
    elmnt = z[i];
    /*search for elements with a certain atrribute:*/
    file = elmnt.getAttribute("w3-include-html");
    if (file) {
      /* Make an HTTP request using the attribute value as the file name: */
      xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function() {
        if (this.readyState == 4) {
          if (this.status == 200) {elmnt.innerHTML = this.responseText;}
          if (this.status == 404) {elmnt.innerHTML = "Page not found.";}
          /* Remove the attribute, and call this function once more: */
          elmnt.removeAttribute("w3-include-html");
          includeHTML();
        }
      }
      xhttp.open("GET", file, true);
      xhttp.send();
      /* Exit the function: */
      return;
    }
  }
}

function canvasClean(idx) {
	lastAnnotation[idx] = $("#annotations" + idx).val();
	lastTERN[idx] = $("#tern"+ idx).val();
	lastNotField[idx] = $("#not" + idx).val();
	
	$("#annotations" + idx).val('');
	$("#tern" + idx).val('');
	$("#not" + idx).val('');
	
	lastCanvasObjects[idx] = canvases[idx].getObjects();		
	
	canvases[idx].discardActiveObject().renderAll();
	canvases[idx].getObjects().forEach(function(o) {
		console.log("----> "+o.get('type'));
		if (o.get('type') != 'line') {
        	$("#" + o.get('uuid')).hide();
        	canvases[idx].remove(o);
		} 
    })
}

function reset() {
	canvasClean(0);
	canvasClean(1);
	lastis43 = $("#is43").is(":checked");
	lastis169 = $("#is169").is(":checked");
	lastisColor[0] = $("#isColor0").is(":checked");
	lastisColor[1] = $("#isColor1").is(":checked");
	lastisGray[0] = $("#isGray0").is(":checked");
	lastisGray[1] = $("#isGray1").is(":checked");
	lastOccur = $('#and').is(':checked');
	lastQBE = $("#urlToUpload").val();
	console.log(lastQBE);



	lastGrouped = $("#group").is(":checked");
	lastIsCanvasEnabled[0] = isCanvasEnabled[0];
	lastIsCanvasEnabled[1] = isCanvasEnabled[1];
	lastSimreorder = simreorder;
	console.log(lastIsCanvasEnabled);
			
	$('#is43').prop('checked', false);
	$('#is169').prop('checked', false);
	$('#isColor0').prop('checked', false);
	$('#isColor1').prop('checked', false);
	$('#isGray0').prop('checked', false);
	$('#isGray1').prop('checked', false);
	$("#and").prop("checked", true);
	$('#group').prop('checked', false);
	$('#is43').prop('checked', false);
	$('#simreorder').prop('checked', false);
	$('#urlToUpload').val('');
	$('#qbe').removeAttr("style").hide();
	
	
	//$('input[name=radioName]:checked', '#myForm').val()
	//$('input[name="canvas0"][value="enabled"]').prop('checked', true);
	//$('input[name="canvas1"][value="enabled"]').prop('checked', true);
	$('input:radio[name=canvas0]')[0].checked = true;
	$('input:radio[name=canvas1]')[0].checked = true;

	setCanvasState(0, this);

}

function undoReset() {
	canvasCleanUndo(0);
	canvasCleanUndo(1);
	$('#is43').prop('checked', lastis43);
	$('#is169').prop('checked', lastis169);
	$('#isColor0').prop('checked', lastisColor[0]);				
	$('#isColor1').prop('checked', lastisColor[1]);				
	$('#isGray0').prop('checked', lastisGray[0]);
	$('#isGray1').prop('checked', lastisGray[1]);
	$('#and').prop('checked', lastOccur);
	$('#or').prop('checked', !lastOccur);
	$('#urlToUpload').val(lastQBE);
	console.log(lastQBE);

	

	$('#group').prop('checked', lastGrouped);
	$('#simreorder').prop('checked', lastSimreorder);

	console.log(lastIsCanvasEnabled);
	if (!lastIsCanvasEnabled[0])
		$('input:radio[name=canvas0]')[1].checked = true;
	if (!lastIsCanvasEnabled[1])
		$('input:radio[name=canvas1]')[1].checked = true;
	setCanvasState(0, this);

}

function canvasCleanUndo(idx) {
	$("#annotations" + idx).val(lastAnnotation[idx]);
	$("#tern" + idx).val(lastTERN[idx]);
	$("#not" + idx).val(lastNotField[idx]);
	lastCanvasObjects[idx].forEach(function(o) {
		if (o.get('type') != 'line') {
	        canvases[idx].add(o);
        	$("#" + o.get('uuid')).show();
		}
    })
}
