<%@page import="java.io.File"%>
<%@ page language="java" contentType="text/html; charset=UTF-8"
	pageEncoding="UTF-8"%>
<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<title>Videos</title>
<link href="vbs.css" rel="stylesheet">

</head>
<body>
	<div align="center">
		<h2 style="color: navy;">VBS Videos. Click on a keyframe
			to play the video</h2>
	</div>
		<%
			int itemPerPage = 100;
			int pageNumber = 0;
			String pageParam = request.getParameter("page");
			try {
			if (pageParam != null) {
				pageNumber = Integer.parseInt(pageParam);
			}
			} catch(Exception e) {
				System.out.println(pageParam + " is not a valid page");
			}
			int startItem = pageNumber * itemPerPage + 1;
			int startFor = Math.max(0, pageNumber - 10);
			int endFor = Math.min(74, pageNumber + 10);
			%>
			<div align=center style="padding-bottom: 30px;">
			<a href="videos.jsp?page=0"><b style="color: green;">[0]</b></a>&nbsp;
			<%
			for (int i = startFor; i <= endFor; i++) {
				if (i == pageNumber) {%>	
				
				<b><%=i%></b>&nbsp;
	<%
				} else {
		%>	
			
					<a href="videos.jsp?page=<%=i%>"><%=i%></a>&nbsp;
		<%
				}
			}
		%>
				<a href="videos.jsp?page=74"><b style="color: green;">[74]</b></a>
				
				</div>
			
	<table align="center">
		<%	
			for (int i = startItem; i < startItem + itemPerPage; i++) {
				if (i > 7475)
					break;
				String id = Integer.toString(i);
				int zerosEnd = 5 - id.length();
				for (int zeros = 0; zeros < zerosEnd; zeros++)
					id = "0" + id;
				String videoExt = ".mp4";
				if ((i - startItem) % 5 == 0)
					out.print("<tr>");
				out.print("<td><div style='float: left;'>" + id
						+ "</div><div style='float: right;'><a href='http://bilioso.isti.cnr.it:8080/Visione3/showVideoKeyframes.jsp?id=" + id + "/shot" + id
						+ "_1.png' target='_blank'>Keyframes</a>&nbsp;</div><br><a href='http://visione.isti.cnr.it/vbsVideos2022/video480/"
						+ id + videoExt + "'<br><img src='http://visione.isti.cnr.it/vbsthumbs2022/v3c1/" + id
						+ "/" + id + "_5.jpg'></a></td>");
			}
		%>
	</table>
</body>
</html>