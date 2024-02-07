/*function changeImage(imageURL, objectID) {
	//alert(imageURL + " - " + objectID);
	if (document.getElementById('objId').value==objectID || objectID == "" || imageURL == "null" || objectID == "null") {
		document.getElementById('advSearch').style.display = 'none';
		//document.getElementById('comboInfo').style.display = 'none';
		  document.getElementById('queryImage').src='queryImage';
		  document.getElementById('objId').value='';
		  document.getElementById('objId').name="disabled";
	}
	else {
	  document.getElementById('advSearch').style.display = '';
	  //document.getElementById('comboInfo').style.display = '';
	  document.getElementById('queryImage').src=imageURL;
	  document.getElementById('objId').value=objectID;
	  document.getElementById('objId').name="id";

	  //document.getElementById('imageQueryCheckbox').checked='checked';
	  document.getElementById('objId').name="id";
	  document.getElementById('queryImage').style.display = '';

	  if (document.getElementById('imageToUpload') != null) {
		  document.getElementById('imageToUpload').value="";
	  }
	}
//	if (imageURL != "null" && imageURL != "" && imageURL == objectID) {
//		document.getElementById('objId').name="url";
//	}
}

function imageQuery() {
	//alert(imageURL + " - " + objectID);
	if (!document.getElementById('imageQueryCheckbox').checked) {
		  document.getElementById('objId').name="disabled";
		  document.getElementById('queryImage').style.display = 'none';
	}
	else {
	  document.getElementById('objId').name="id";
	  document.getElementById('queryImage').style.display = '';
	}
}*/

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
			document.getElementById("searchbar").action="./searchByURL"
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

			document.getElementById("searchbar").action="./searchByImg"
			document.getElementById("searchbar").enctype="multipart/form-data";
			document.getElementById("searchbar").method="POST";
		}
}

function queryImg() {
	let queryUrl =  $('#urlToUpload').val();

	if (queryUrl != null && queryUrl.trim() != '') {
		document.getElementById('qbeblock').style.display = 'block';

		$('#qbeImg').attr('src', queryUrl);
		console.log(document.getElementById('qbeImg').src);
		console.log($('#qbeImg').attr('src'));

		//document.getElementById('qbe').src=document.getElementById('urlToUpload').value;
		queryByExample(document.getElementById('urlToUpload').value);
	} else {
		var fileInput = $('#imageToUpload')[0];
		var file = fileInput.files[0];
		var reader = new FileReader();

		reader.onload = function(e) {
		  var base64Data = e.target.result;
		  // Utilizza la base64Data come desideri
		  console.log(base64Data);
		  document.getElementById('qbeblock').style.display = 'block';

		  $('#qbeImg').attr('src', base64Data);
		  queryByExample(base64Data);


		}

		reader.readAsDataURL(file);

	}
}

function resetQueryImg() {
	document.getElementById('qbe').src='';
	document.getElementById('urlToUpload').value='';
	document.getElementById('qbeblock').style.display = 'none';
	showResults(null);
}

function clearQuery() {
	if (document.getElementById('urlToUpload').value.trim() == '')
		document.getElementById('qbe').style.display = 'none';
		document.getElementById('queryImage').value='';
}

function trim(str) {
	return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
}

function getWindowHeight() {
	var windowHeight = 0;
	if (typeof(window.innerHeight) == 'number') {
		windowHeight = window.innerHeight;
	}
	else {
		if (document.documentElement && document.documentElement.clientHeight) {
			windowHeight = document.documentElement.clientHeight;
		}
		else {
			if (document.body && document.body.clientHeight) {
				windowHeight = document.body.clientHeight;
			}
		}
	}
	return windowHeight;
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

