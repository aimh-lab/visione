<%@page import="com.visualengines.deeplearning.services.Settings"%>
<%@page import="java.io.InputStreamReader"%>
<%@page import="java.net.URL"%>
<%@page import="java.io.BufferedReader"%>
<%@page import="java.util.List"%>
<%@page import="java.util.ArrayList"%>
<%@page import="java.util.Collections"%>
<%@page import="java.util.Comparator"%>
<%@page import="java.util.Arrays"%>
<%@page import="java.io.File"%>
<%@page import="java.io.FileReader"%>
<%@page import="org.json.simple.JSONArray"%>
<%@page import="org.json.simple.JSONObject"%>
<%@page import="org.json.simple.parser.JSONParser"%>

<%@ page language="java" contentType="text/html; charset=UTF-8"
	pageEncoding="UTF-8"%>
<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<title>Video Keyframes</title>
<link rel="stylesheet" href="css/jquery-ui.min.css" >
<link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.5.0/css/all.css" >
<link rel="stylesheet" href="css/bootstrap.css" >
<link rel="stylesheet" href="css/vbs.css" >
<script src="js/jquery-3.3.1.min.js"></script>
<script src="js/jquery-ui.min.js"></script>
<script src="js/fabric.js"></script>
<script src="js/vbs_visione3.js"></script>

</head>
<body>

	<%
	JSONParser parser = new JSONParser();
			//Object obj = parser.parse(new FileReader("/home/paolo/development/java-projects/mim/Visione/WebContent/js/conf.json"));
			Object obj = parser.parse(new InputStreamReader(new URL(request.getRequestURL().substring(0, request.getRequestURL().lastIndexOf("/")) + "/js/conf.json").openStream()));
			JSONObject jsonObject = (JSONObject) obj;
			//String keyframesFolder = "C:\\Users\\franca\\eclipse-workspace10\\Visione\\WebContent\\video\\";
			String urlPrefix = (String) jsonObject.get("thumbnailUrl");		
			String videoUrl = (String) jsonObject.get("videoUrl");
			String query = request.getParameter("query");
			String collection = request.getParameter("collection") != null ? request.getParameter("collection"): "";
			String id = request.getParameter("id");
			String videoID = id.split("/")[0];
			String keyframeID = id.split("/")[1];
			boolean admin = true;
			String videoExt = ".mp4";
			String thumbnailsFolder = Settings.THUMBNAILS_FOLDER + collection + "/";
			System.out.println(thumbnailsFolder);
	%>

	<div align="center" style="font-size: x-large; padding: 15px;">
		<span style="color: navy;">Collection: </span> 
		<span style="color: red;"><%=collection.toUpperCase()%> </span> <span style="color: navy;">Video</span> <span><a onclick="log('videoPlayer,<%=videoID%>'); return true;"
			style="color: red;" title='Play video'
			href='<%=videoUrl%><%="video480/" + videoID + videoExt%>'><%=videoID%></a></span>
		<span style="color: navy;">- Keyframe</span> <span><a
			style="color: red;" title="go to keyframe"
			href="#<%=keyframeID.split("\\.")[0]%>"><%=keyframeID.split("\\.")[0]%></a></span>
	</div>
	<script>log("videoSummary,<%=videoID%>"); </script>

	<table align="center" style="width: 1200px;"><tr><td>
		<%
			class Comp implements Comparator<File> {

				public int compare(File o1, File o2) {
					int num1 = Integer.parseInt(o1.getName().split("_")[1].split("\\.")[0]);
					int num2 = Integer.parseInt(o2.getName().split("_")[1].split("\\.")[0]);
					if (num1 > num2) {
						return 1;
					} else if (num1 < num2) {
						return -1;
					} else {
						return 0;
					}
				}
			}
			System.out.println(thumbnailsFolder + videoID);
			File[] keyframes = new File(thumbnailsFolder + videoID).listFiles();
			List<File> keyframesList = Arrays.asList(keyframes);
			Collections.sort(keyframesList, new Comp());
			for (int i = 0; i < keyframes.length; i += 1) {
				String keyFrameName = keyframes[i].getName();
				String link = "";
				if (admin)
					link = "<div class='myalign'> <a href='indexedData.html?collection=" + collection + "&id=" + videoID + "/" + keyFrameName
							+ "' title='Show Indexed Data' target='_blank' >" + keyFrameName + "</a>"
							+"<i class='fa fa-play' style='color:#007bff;padding-left: 5px;' onclick='playVideoWindow(\"" + collection + "\", \"" + videoID + "\", \"" + videoID + "/" + keyFrameName+ "\"); return false;'></i>"

							+"<span class='pull-right'><i title='Submit result' class='fa fa-arrow-alt-circle-up' style='font-size:21px; float: right; color:#00AA00; padding-left: 0px;' "
							+ "onclick=\"submitWithAlert('"+ videoID + "/" + keyFrameName+ "','"+query+"'); return false;\"></i></span></div>";
				if (i % 6 == 0) {
					out.print(" <div class='row'>");
				}

				if (keyFrameName.equals(keyframeID)) {
					//keyFrameName = keyFrameName + ".jpg";
					out.print("<div class='col-2 with-margin'>" + link + "<img src='" + urlPrefix + collection + "/" + videoID + "/"
							+ keyFrameName + "' title='" + keyFrameName + "' class='rounded myborder' id='"
							+ keyframeID.split("\\.")[0] + "'/></div>");
				} else {
					//keyFrameName = keyFrameName + ".jpg";
					out.print("<div class='col-2 with-margin'>" + link + "<img src='" + urlPrefix + collection + "/" + videoID + "/"
							+ keyFrameName + "' title='" + keyFrameName + "' class='rounded'/></div>");
				}
				if (i % 6 == 5) {
					out.print("</div>");
				}
			}
		%>
	</td></tr></table>
</body>
</html>