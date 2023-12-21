
package it.cnr.isti.visione.logging;

import java.util.List;

public class VisioneLogging {

	public long timestamp;
	public String type;
	public List<Query> queries;
	private List<ResultSet> results = null;
	private String videoId;
	private int frameNum;
	private long timeNum;
	private String videoTime;
	private String sessionId;
	private String simReorder;

	public String getSessionId() {
		return sessionId;
	}

	public void setSessionId(String sessionId) {
		this.sessionId = sessionId;
	}

	public String getSimReorder() {
		return simReorder;
	}

	public void setSimReorder(String simReorder) {
		this.simReorder = simReorder;
	}

	public String getVideoId() {
		return videoId;
	}

	public void setVideoId(String videoId) {
		this.videoId = videoId;
	}

	public int getFrameNum() {
		return frameNum;
	}

	public void setFrameNum(int frameNum) {
		this.frameNum = frameNum;
	}
	
	public long getTimeNum() {
		return timeNum;
	}

	public void setTimeNum(long timeNum) {
		this.timeNum = timeNum;
	}

	public String getVideoTime() {
		return videoTime;
	}

	public void setVideoTime(String videoTime) {
		this.videoTime = videoTime;
	}

	public long getTimestamp() {
	return timestamp;
	}

	public void setTimestamp(long timestamp) {
	this.timestamp = timestamp;
	}

	public String getType() {
	return type;
	}

	public void setType(String type) {
	this.type = type;
	}

	public List<Query> getQueries() {
	return queries;
	}

	public void setQueries(List<Query> queries) {
	this.queries = queries;
	}
	
	public List<ResultSet> getResults() {
	return results;
	}

	public void setResults(List<ResultSet> results) {
	this.results = results;
	}

}
