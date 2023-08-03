const avsAuto = new Map();
const avsAutoByVideoID = new Map();
const avsManual = new Map();
const avsManualByVideoID = new Map();
const avsSubmitted = new Map();
const avsManualRemoved = new Map();

avsAutoSelected = []
maxAutoSelected = 9


function getAvsObj(videoId, imgId, avsTagId, thumb) {
	avsObj=new Object();
	avsObj.videoId = videoId;
	avsObj.imgId = imgId;
	avsObj.avsTagId = avsTagId;
	avsObj.thumb = thumb;
	return JSON.stringify(avsObj) 
}

function addToAutoSelected(avsJSON) {
	const avsObj = JSON.parse(avsJSON);
	avsAutoSelected.push(avsObj);
}

function submitAVS() {
	$('#submitted_bar').css("display", "block");
	for (let [key, selectedItem] of avsAuto) {
		//res = submitResultAVS(keyframeId, avsQueryLog.get(keyframeId));
		res = submitToServer(selectedItem);
		avsRemoveSelected(selectedItem)
		updateAVSTab(selectedItem)
		avsSubmitted.set(selectedItem.videoId,selectedItem);
		avsSubmittedTab(selectedItem);

	}

	for (let [key, selectedItem] of avsManual) {
		//res = submitResultAVS(keyframeId, avsQueryLog.get(keyframeId));
		res = submitToServer(selectedItem);
		avsRemoveSelected(selectedItem)
		updateAVSTab(selectedItem)
		avsSubmitted.set(selectedItem.videoId, selectedItem);
		avsSubmittedTab(selectedItem);

	}
	$( "#submitted_num" ).text(avsSubmitted.size)
	updateAVSInfo();
	avsHideSubmittedVideos();
	avsAddAutoselected();
}

function submitToServer(selectedItem) {
	return $.ajax({
		type: "GET",
		async: true,
		url: urlBSService + "/submitResult?id=" + selectedItem.imgId + "&videoid=" + selectedItem.videoId + "&isAVS=true&simreorder=" + simreorder,
	}).responseText;
}

function selectImg(selectedItem) {
	let videoUrl = videoUrlPrefix +selectedItem.videoId+".mp4";
	let videoUrlPreview = videoshrinkUrl + selectedItem.videoId+".mp4";


	let img = '<span id="avsList_' + selectedItem.imgId + '">'
	
	img += '<div style="float: left; padding: 2px;">'
			+'<a style="font-size:12px; padding-left: 2px;" title="' + selectedItem.imgId  + '" href="indexedData.html?videoId=' + selectedItem.videoId + '&id='+ selectedItem.imgId+ '" target="_blank">'+ selectedItem.videoId+'</a>'
			+'<a href="showVideoKeyframes.html?videoId=' + selectedItem.videoId + '&id='+ selectedItem.imgId + '#'+ selectedItem.imgId + '" target="_blank"><i class="fa fa-th" style="font-size:12px;  padding-left: 3px;"></i></a>'
			+'<i class="fa fa-play" style="font-size:12px; color:#007bff;padding-left: 3px;" onclick="playVideoWindow(\''+ videoUrl + '\', \''+ selectedItem.videoId+ '\', \''+selectedItem.imgId+'\'); return false;"></i>'
			+'<img style="float: right; padding: 1px;" title="remove ' + selectedItem.imgId + '" width="20" src="img/Actions-dialog-close-icon.png" onclick=\'avsToggle(' + JSON.stringify(selectedItem)  + ')\'>'

			+'<br>'
			+'<div id="avsdiv_' + selectedItem.imgId + '" lang="' + selectedItem.videoId + '|' + videoUrlPreview  + '">'
			+'<img id="selected_avs_' + selectedItem.imgId + '" "title="' + selectedItem.imgId + '" style="padding-bottom: 10px;" width="145" height= "90" src="' + selectedItem.thumb + '">'
			+'</div></div></span>'
			
	$("#avsTab").append(img);
		
	if (document.getElementById(selectedItem.avsTagId) != null)
		document.getElementById(selectedItem.avsTagId).checked = true;
	if (document.getElementById(selectedItem.imgId) != null) {
		document.getElementById(selectedItem.imgId).style.borderWidth = "12px";
		document.getElementById(selectedItem.imgId).style.borderStyle = "dashed";
	}
		
		let imgId4Regex = selectedItem.imgId.replaceAll(".", "\\.")
				
		var cip = $("#avsdiv_" + imgId4Regex).hover( hoverVideoAVS, hideVideoAVS );
		
		function hoverVideoAVS(e) {
			let avsdivNoRegex = this.id
			let avsdiv = avsdivNoRegex.replaceAll(".", "\\.")
			let imgIdNoRegex = avsdivNoRegex.replaceAll("avsdiv_", "selected_avs_")
			let imgId = imgIdNoRegex.replaceAll(".", "\\.")
			let imgIdAVS = avsdivNoRegex.replaceAll("avsdiv_", "")

			//imgId = this.id.replaceAll("selected_avs_", "")

			$('#' + imgId).contextmenu(function() {
				//langInfo = this.lang.split('|');
				let langInfo = document.getElementById(avsdivNoRegex).lang.split('|');

				let videoId = langInfo[0];
				let videourl = langInfo[1];
				let playerId = 'video' + videoId;

				var elementExists = document.getElementById(playerId);

				//var startTime = getStartTime(imgIdNoRegex);
				//var endTime = getEndTime(imgIdNoRegex);
				var middleTime = getMiddleTimestamp(imgIdAVS);
				var startTime = middleTime -2;
				var endTime = middleTime+2;
				if (elementExists != null) {
 					$('#'+ playerId).get(0).pause();
				    $('#'+ playerId).attr('src', videourl + '#t=' + startTime + ',' + endTime);
				    $('#'+ playerId).get(0).load();
					$('#'+ playerId).get(0).play();
					return;
				}
				let backgroundImg = "background-image: url('" + thumbnailUrl+ '/'+ imgIdNoRegex + "')";
			
				//imgtable = '<div class="video"><video style="' + backgroundImg + '" id="' + playerId + '" title="'+ this.alt+ '" class="myimg-thumbnail" loop preload="none"><source src="' + this.title + '" type="video/mp4"></video></div>'
				//imgtable = '<video style="' + backgroundImg + '" id="' + playerId + '" title="'  + this.title + '" class="myimg video" loop muted preload="none"><source src="' + videourl + '" type="video/mp4"></video>'
				//imgtable = '<video style="' + backgroundImg + '" id="' + playerId + '" class="myimg video" loop muted preload="none"><source src="' + videourl + '" type="video/mp4"></video>'
				let imgtable = '<video id="' + playerId + '" class="myimg video" autoplay loop muted preload="none"><source src="' + videourl + '#t=' + startTime + ',' + endTime + '" type="video/mp4"></video>'
				$('#' + avsdiv).append(imgtable);
				$('#' + imgId).css("display", "none");

				//$('#'+ playerId).get(0).currentTime = time-1;
				//$('#'+ playerId).get(0).play();
				return false;
			});		
		}
				
		function hideVideoAVS(e) {
 			let avsdivNoRegex = this.id
			let avsdiv = avsdivNoRegex.replaceAll(".", "\\.")
			let imgId = avsdiv.replaceAll("avsdiv_", "selected_avs_")
			let langInfo = document.getElementById(avsdivNoRegex).lang.split('|');
			let videoId = langInfo[0];
			let videourl=langInfo[1];
			let playerId = 'video' + videoId;
 
			var elementExists = document.getElementById(playerId);
			if (elementExists != null) {
				$('#' + playerId).remove();
				$('#' + imgId).css("display", "block");
			}
		}
}

function unselectImg(selectedItem) {
	if (document.getElementById("avsList_" + selectedItem.imgId) != null) {
		document.getElementById("avsList_" + selectedItem.imgId).remove();
		unselectImg(selectedItem)
	}
	if (document.getElementById(selectedItem.avsTagId) != null)
		document.getElementById(selectedItem.avsTagId).checked = false;
	if (document.getElementById(selectedItem.imgId) != null) {
		document.getElementById(selectedItem.imgId).style.borderWidth = "3px";
		document.getElementById(selectedItem.imgId).style.borderStyle = "solid";
	}
}

function updateAVSInfo() {
	$("#avsInfo").remove();
	avsText = "";
	selectedSize = avsAuto.size + avsManual.size
	if (avsAuto.size > 0 || avsSubmitted.size > 0 || avsManual.size > 0) {
		avsText = '<div title="Selected images for AVS Tasks" id="avsInfo"><span style="float: right;color:brown; font-size: larger;">Selected: <b style="color: Coral; font-size:large;">' + selectedSize + '</b></span>';
		if (avsAuto.size > 0 || avsManual.size > 0) {
			avsText += '<span class="pull-left"><i title="Submit AVS image List" class="fa fa-arrow-alt-circle-up" style="font-size:36px; float: left; color:#00AA00; padding-right: 10px;" onclick="submitAVS(); return false;"></i></span>';
			avsText += '<span class="pull-left"><i title="Submit AVS image List" class="fa fa-arrow-alt-circle-up" style="font-size:36px; float: right; color:#00AA00; padding-right: 10px;" onclick="submitAVS(); return false;"></i></span></div>';
		}
		$("#avsTab").prepend(avsText);
	}
}

function updateAVSTab(selectedItem) {
	if (avsSubmitted.has(selectedItem.videoId)) {
		return;
	}
	else if (avsManual.has(selectedItem.imgId) || avsAuto.has(selectedItem.imgId)) {
		selectImg(selectedItem)
	}
	else {
		unselectImg(selectedItem)
	}
	updateAVSInfo();
}

function avsToggle(selectedItem) {
	//selectedItem = JSON.parse(avsJSON);
	let avsItem = document.getElementById(selectedItem.avsTagId);
	if (avsItem == null || !avsItem.checked) {
		if (avsAutoByVideoID.has(selectedItem.videoId)) {
			let autoSelectedToRemove = avsAutoByVideoID.get(selectedItem.videoId);
			avsAuto.delete(autoSelectedToRemove.imgId);
			avsAutoByVideoID.delete(selectedItem.videoId);
			updateAVSTab(autoSelectedToRemove);
		} 
		else if (avsManualByVideoID.has(selectedItem.videoId)) {
			let manualSelectedToRemove = avsManualByVideoID.get(selectedItem.videoId);
			avsManual.delete(manualSelectedToRemove.imgId);
			avsManualByVideoID.delete(selectedItem.videoId);
			updateAVSTab(manualSelectedToRemove);
		}
		if (avsItem != null) {
			avsManual.set(selectedItem.imgId, selectedItem);
			avsManualByVideoID.set(selectedItem.videoId, selectedItem);
			avsManualRemoved.delete(selectedItem.imgId)
		}


	}
	else {
		if (avsManual.has(selectedItem.imgId)) {
			avsManual.delete(selectedItem.imgId);
			avsManualByVideoID.delete(selectedItem.videoId);
		}
		else 
			if (avsAuto.has(selectedItem.imgId)) {
				avsAuto.delete(selectedItem.imgId);
				avsAutoByVideoID.delete(selectedItem.videoId);
			}
		avsManualRemoved.set(selectedItem.imgId, selectedItem)
	}
	updateAVSTab(selectedItem);
}

function avsRemoveSelected(selectedItem) {
	if (!avsSubmitted.has(selectedItem.videoId)) {
		if (avsManual.has(selectedItem.imgId)) {
			avsManual.delete(selectedItem.imgId);
			avsManualByVideoID.delete(selectedItem.videoId);
		}
		else if (avsAuto.has(selectedItem.imgId)) {
			avsAuto.delete(selectedItem.imgId);
			avsManualByVideoID.delete(selectedItem.videoId);
		}
	}
}

function avsAddAutoselected() {
	selectedCounter = 0;
	for (avsIDX = 0; avsIDX < avsAutoSelected.length && selectedCounter < maxAutoSelected; avsIDX++) {
		if (avsManual.has(avsAutoSelected[avsIDX].imgId) || avsManualByVideoID.has(avsAutoSelected[avsIDX].videoId) || avsSubmitted.has(avsAutoSelected[avsIDX].videoId) || avsManualRemoved.has(avsAutoSelected[avsIDX].imgId))
			continue;
		avsAuto.set(avsAutoSelected[avsIDX].imgId, avsAutoSelected[avsIDX]);
		avsAutoByVideoID.set(avsAutoSelected[avsIDX].videoId, avsAutoSelected[avsIDX]);
		updateAVSTab(avsAutoSelected[avsIDX])
		selectedCounter++;
	}
}

function avsRemoveAutoselected() {
	selectedCounter = 0;
	for (let [key, selectedItem] of avsAuto) {
		if (avsManual.has(selectedItem.imgId))
			continue;
		avsAuto.delete(selectedItem.imgId);
		avsAutoByVideoID.delete(selectedItem.videoId);
		updateAVSTab(selectedItem)
	}
}

function avsSubmittedTab(selectedItem) {
	videoUrl = videoUrlPrefix + selectedItem.videoId+".mp4";
	
	img = '<div id="avsSubmittedList_' + selectedItem.imgId + '">';
	
	
	img += '<a style="font-size:9px;" title="' + selectedItem.imgId  + '" href="indexedData.html?videoId=' + selectedItem.videoId + '&id='+ selectedItem.imgId+ '" target="_blank">'+ selectedItem.videoId+'</a>'
			//+'<a href="showVideoKeyframes.html?videoId=' + selectedItem.videoId + '&id='+ selectedItem.imgId + '#'+ selectedItem.imgId + '" target="_blank"><i class="fa fa-th" style="font-size:12px;  padding-left: 3px;"></i></a>'
			+'<i class="fa fa-play" style="font-size:10px; color:#007bff;padding-left: 3px;" onclick="playVideoWindow(\''+ videoUrl+ '\', \''+ selectedItem.videoId+ '\', \''+selectedItem.imgId+'\'); return false;"></i>'
			+'<img style="padding: 2px;" src="img/gem_icon.svg" width=20 title="image similarity" alt="' + selectedItem.imgId + '" id="gemSim' + selectedItem.imgId + '" onclick="var queryObj=new Object(); queryObj.vf=\'' + selectedItem.imgId + '\'; searchByLink(queryObj); return false;">'
			+'<img style="padding: 2px;" src="img/aladin_icon.svg" width=20 title="semantic similarity" alt="' + selectedItem.imgId + '" id="aladinSim' + selectedItem.imgId + '" onclick="var queryObj=new Object(); queryObj.aladinSim=\'' + selectedItem.imgId + '\'; searchByLink(queryObj); return false;">'
			+'<img style="padding: 2px;" src="img/clip_icon.svg" width=20 title="semantic video similarity" alt="' + selectedItem.imgId + '" id="clipSim' + '" onclick="var queryObj=new Object(); queryObj.clipSim=\'' + selectedItem.imgId + '\'; searchByLink(queryObj); return false;">'
			+'<br>'
	
	
	img += '<img title="' + selectedItem.imgId + '"style="padding-bottom: 10px;" width="110" height="80" src="' + selectedItem.thumb + '"></div>';
	$("#avsSubmittedTab").append(img);
}

function avsHideSubmittedVideos() {
	for (let [videoId, selectedItem] of avsSubmitted) {
		$("[id^=video_" + videoId + "]").remove();
		//document.getElementById("video_" + videoId).style.display = 'none';
		
	}
}



function avsCleanManualSelected() {
	for (let [key, selectedItem] of avsManual) {
		//updateAVSTab(id, null, keyframeId)
		unselectImg(selectedItem)
	}
}

function avsReloadManualSelected() {
	for (let [key, selectedItem] of avsManual) {
		try {
			updateAVSTab(selectedItem)
		} catch (error) {
			console.log("AVS " + selectedItem.imgId + " is not in the results list");
		}
	}
}