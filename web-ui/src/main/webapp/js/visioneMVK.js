function handler() {
	  if (this.readyState == 4 && this.status == 200) {
		  console.log(this.responseText)
	    var myObj = JSON.parse(this.responseText);
		  urlBSService = myObj.serviceUrl;
		  speech2TextService = myObj.speech2Text;
		  thumbnailUrl= myObj.thumbnailUrl;
		  keyFramesUrl=myObj.keyFramesUrl;
		  videoUrlPrefix=myObj.videoUrl;
		  videoshrinkUrl=myObj.videoshrinkUrl;
	
	  }
  
};

var client  = new XMLHttpRequest();
client.onload = handler;
client.open("GET", "js/conf_mvk.json", false);
client.send(); 