package it.cnr.isti.visione.logging;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map.Entry;
import com.google.gson.Gson;


import org.openapitools.client.model.QueryEvent;
import org.openapitools.client.model.QueryEventLog;
import org.openapitools.client.model.QueryResult;
import org.openapitools.client.model.QueryResultLog;
import org.openapitools.client.model.CurrentTime;
import dev.dres.client.StatusApi;

import com.google.gson.Gson;

import it.cnr.isti.visione.lucene.Fields;
import it.cnr.isti.visione.services.SearchResults;
import it.cnr.isti.visione.services.Settings;
import it.cnr.isti.visione.services.VisioneQuery;

public class LogParserDRES {
	
	
	private File destFolder;
	private QueryResultLog resultLog = new QueryResultLog();
	
	public QueryResultLog getResultLog() {
		return this.resultLog;
	}
	
	public LogParserDRES(File destFolder) {
		this.destFolder = destFolder;
	}
	
//	public synchronized void save() throws IOException {		
//		if (destFolder != null) {
//			long time = System.currentTimeMillis();
//			if (getResultLog() != null) {
//				try (BufferedWriter writer = new BufferedWriter(new FileWriter(new File(destFolder, time + ".resultLog.json")))) {
//					writer.write(getResultLog().toString());
//				}
//			}
//			
//		}
//	}
	
	
	public synchronized void save(long timestamp, String sessionid, String user) throws IOException {	
		Gson gson= new Gson();
		String fn=timestamp+"_"+sessionid+"_"+user;
		if (destFolder != null) {
			if (getResultLog() != null) {
				try (BufferedWriter writer = new BufferedWriter(new FileWriter(new File(destFolder, fn + ".json")))) {
				//	writer.write(getResultLog().toString()); 
					writer.write(gson.toJson(getResultLog()));
				}
			}
			
		}
	}
	
	public synchronized void save_submission_log(long timestamp, String sessionid, String user, String value) throws IOException {	
		Gson gson= new Gson();
		String fn=timestamp+"_"+sessionid+"_"+user+"_SUBMISSION";
		this.resultLog = new QueryResultLog();
		resultLog.setTimestamp(timestamp);
		resultLog.setResultSetAvailability("Top10000");
		resultLog.setSortType("rankingModel");
		
		QueryEvent queryEvent = new QueryEvent();
		queryEvent.setTimestamp(timestamp);
		queryEvent.setCategory(getCategoryEnum("browsing"));
		queryEvent.setType("Submission");
		queryEvent.setValue(value);
		resultLog.addEventsItem(queryEvent);
		
		if (destFolder != null) {
			if (getResultLog() != null) {
				try (BufferedWriter writer = new BufferedWriter(new FileWriter(new File(destFolder, fn + ".json")))) {
					writer.write(gson.toJson(getResultLog()));
				}
			}
			
		}
	}
	
	
	/**
	 * Create a DRES QueryResultLog event given the VISIONE query and results
	 * @param queries Lucene queries used to get the current resultset
	 * @param simReorder parameter used in Lucene
	 * @param resultset  ranked SearchResults
	 * @return clientTimestamp timestamp of the log
	 * @throws IOException
	 */
	public synchronized long query2Log(List<VisioneQuery> queries, boolean simReorder, ArrayList<SearchResults> resultset) throws IOException {
		int rank = 1;
		this.resultLog = new QueryResultLog();
		long clientTimestamp = System.currentTimeMillis();
		resultLog.setTimestamp(clientTimestamp);
		resultLog.setResultSetAvailability("Top10000");
		resultLog.setSortType("rankingModel");
		//creating result list 
		for (int i = 0; i < resultset.size(); i ++) {
			QueryResult resultItem = new QueryResult();
			SearchResults res=resultset.get(i);
			resultItem.setItem(res.videoId);
			resultItem.setFrame(res.middleFrame);
			resultItem.setRank(rank++);
			resultItem.setScore((double) res.score);
			resultLog.addResultsItem(resultItem);
		}

		//creating event list 
		for (int queryIdx = 0; queryIdx < queries.size(); queryIdx++) {
			Iterator<Entry<String, String>> queryIterator = queries.get(queryIdx).getQuery().entrySet().iterator();
			Iterator<Entry<String, String>> queryParametersIterator=queries.get(queryIdx).getParameters().entrySet().iterator();
			String queryParam=""; //string containing query parameter
			while(queryParametersIterator.hasNext()) {
				Entry<String, String> entry = queryParametersIterator.next();
				queryParam+=" > "+entry.getKey()+"="+entry.getValue();
			}			
			String temporaltTxT="";
			if(queries.size()>1)
				temporaltTxT=" > Temporal_query "+(queryIdx+1);
			while(queryIterator.hasNext()) {
				Entry<String, String> entry = queryIterator.next();
				String keyField=entry.getKey();
				String value=entry.getValue();
				QueryEvent queryEvent = new QueryEvent();
				queryEvent.setTimestamp(clientTimestamp);
				queryEvent.setCategory(getCategoryEnum(getCategory(keyField)));
				queryEvent.setType(getType(keyField)+" > "+getSubType(keyField)); //TODO see if in DRES they have added a subtype 
				queryEvent.setValue(value+temporaltTxT+queryParam); //TODO see if in DRES they have added an additional fieldto store query param and temporal info 
				resultLog.addEventsItem(queryEvent);
			}
		}
		return clientTimestamp;
	}

	
	
	public static final String TXT = "txt";
		
	public static final String OBJECTS = "objects";
	
	public static final String MI_FILE_ANNOTATIONS = "mifile";
	
	public static final String VISUAL_FEATURES = "features";
	
	
	private String getCategory(String field) { //category dictionary
		String category;
		
		switch (field) {
		case "objects":
			category = "text";
			break;
			
		case "txt":
			category = "text";
			break;
			
		case "color": //TODO deprecated?
			category = "sketch";
			break;
			
		case "colorTXT": //TODO deprecated?
			category = "sketch"; 
			break;
			
		case "bw":
			category = "filter";
			break;
			
		case "ratio":
			category = "filter";
			break;
			
		case "mifile":
			category = "text";
			break;
			
		case "textual":
			category = "text";
			break;
			
		case "vf":
			category = "image";
			break;
			
		case "qbe":
			category = "image";
			break;
			
		case "ternSim":
			category = "image";
			break;
			
		case "clipSim":
			category = "image";
			break;
		
		case "explicitsort":
			category = "browsing";
			break;
			
		case "rankedlist":
			category = "browsing";
			break;
			
		case "videoplayer":
			category = "browsing";
			break;
			
		case "videosummary":
			category = "browsing";
			break;
		
		default:
			category = "unknownCategory";
		}
		return category;
	}
	
	private QueryEvent.CategoryEnum getCategoryEnum(String field) {
		QueryEvent.CategoryEnum category;
		
		switch (field) {
		case "text":
			category = QueryEvent.CategoryEnum.TEXT;
			break;
			
		case "sketch":
			category = QueryEvent.CategoryEnum.SKETCH;
			break;
			
		case "filter":
			category = QueryEvent.CategoryEnum.FILTER;
			break;
			
		case "image":
			category = QueryEvent.CategoryEnum.IMAGE;
			break;
		
		case "browsing":
			category = QueryEvent.CategoryEnum.BROWSING;
			break;
		
		default:
			category = QueryEvent.CategoryEnum.OTHER;
		}
		
		return category;
	}
	
	private String getType(String field) {
		String type;
		
		switch (field) {
		case "objects":
			type = "LocalizedObjectAndColors";
			break;
		
		case "txt":
			type = "LocalizedObjectAndColors";
			break;
		
		case "color":
			type = "color"; //TODO deprecated?
			break;
			
		case "colorTXT":
			type = "color"; //TODO deprecated?
			break;
			
		case "bw":
			type = "B/W";
			break;
			
		case "ratio":
			type = "resolution";
			break;
			
		case "mifile":
			type = "concept";
			break;
		
		case "vf":
			type = "globalFeatures";
			break;
			
		case "qbe":
			type = "globalFeatures";
			break;
			
		case "ternSim":
			type = "globalFeatures";
			break;
		
		case "clipSim":
			type = "globalFeatures";
			break;
			
		case "textual":
			type = "jointEmbedding";
			break;
			
		case "explicitsort":
			type = "explicitSort";
			break;
		
		case "rankedlist":
			type = "rankedList";
			break;

		case "videosummary":
			type = "videoSummary";
			break;
			
		case "videoplayer":
			type = "videoPlayer";
			break;
		default:
			type = ""; //unknownType
		}
		
		return type;
	}
	
	private String getSubType(String field) {
		String subtype;
		
		switch (field) {
		case "objects":
			subtype = "classes";
			break;
		
		case "txt":
			subtype = "position";
			break;
		
		case "vf":
			subtype = "image similarity (GEM)";
			break;
			
		case "qbe":
			subtype = "image similarity from URL of an image (GEM)";
			break;
			
		case "ternSim":
			subtype = "sematic similarity (ALADIN)";
			break;
		
		case "clipSim":
			subtype = "sematic video similarity (CLIP)";
			break;
			
		default:
			subtype = "";
		}
		
		return subtype;
	}
	
//	class QueryElement {
//		
//		private String field;
//		private String value;
//		
//		public QueryElement(String field, String value) {
//			super();
//			this.field = field;
//			this.value = value;
//		}
//
//		public String getField() {
//			return field;
//		}
//
//		public String getValue() {
//			return value;
//		}
//		
//	}

}
