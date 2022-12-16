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

import org.openapitools.client.model.QueryEvent;
import org.openapitools.client.model.QueryEventLog;
import org.openapitools.client.model.QueryResult;
import org.openapitools.client.model.QueryResultLog;

import com.google.gson.Gson;

import it.cnr.isti.visione.lucene.Fields;
import it.cnr.isti.visione.services.SearchResults;
import it.cnr.isti.visione.services.Settings;
import it.cnr.isti.visione.services.VisioneQuery;

public class LogParserDRES {
	
	private static final String TYPE = "submit";
	
	private Gson gson = new Gson();
	
	private File destFolder;
		
	private String[] colors = {"black", "blue", "brown", "green", "grey", "orange", "pink", "purple", "red", "white", "yellow"};
	private String[] letters = {"a", "b", "c", "d", "e", "f", "g"};
	
	private QueryResultLog resultLog = new QueryResultLog();
	private QueryEventLog eventLog = new QueryEventLog();
	
	
	public QueryResultLog getResultLog() {
		return this.resultLog;
	}
	
	public QueryEventLog getEventLog() {
		return this.eventLog;
	}
	
	private boolean checkColor(String value) {
		for (String color : colors) {
	        if (value.equals("4wc" + color))
	            return true;
	        for (int i = 0; i< 7; i++) {
	        	for (String letter: letters) {
	        		if (value.equals(i + letter + color))
	    	            return true;
	        	}
	        }
	    }
		
		return false;
	}
	
	public LogParserDRES(File destFolder) {
		this.destFolder = destFolder;
	}
	
	public synchronized void save() throws IOException {		
		if (destFolder != null) {
			long time = System.currentTimeMillis();
			try (BufferedWriter writer = new BufferedWriter(new FileWriter(new File(destFolder, time + ".log.json")))) {
				writer.write(getEventLog().toString());
			}
			if (getResultLog() != null) {
				try (BufferedWriter writer = new BufferedWriter(new FileWriter(new File(destFolder, time + ".results.json")))) {
					writer.write(getResultLog().toString());
				}
			}
			
		}
	}
	
	public synchronized void query2Log(List<VisioneQuery> queries, boolean simReorder, ArrayList<SearchResults> resultset) throws IOException {
		int rank = 1;
		this.eventLog = new QueryEventLog();
		this.resultLog = new QueryResultLog();
		resultLog.setTimestamp(System.currentTimeMillis());
		for (int i = 0; i < resultset.size(); i ++) {
			String[] resSplit = resultset.get(i).imgId.split("__");
			for (int splitIdx = 0; splitIdx < resSplit.length; splitIdx++) {
				QueryResult resultItem = new QueryResult();
				String[] resValues = resSplit[splitIdx].split("/");
				String videoID = resValues[0];
				Integer middleFrame = resultset.get(i).middleFrame;
				resultItem.setItem(videoID);
				resultItem.setFrame(middleFrame);
				resultItem.setRank(rank++);
				resultItem.setScore((double) resultset.get(i).score);
				resultLog.addResultsItem(resultItem);
			}
		}

//		this.eventLog = new QueryEventLog();
		
		eventLog.setTimestamp(System.currentTimeMillis());
		
		HashMap<String, Action> actionsHM = new HashMap<>();
		
		
		for (int queryIdx = 0; queryIdx < queries.size(); queryIdx++) {
			Iterator<Entry<String, String>> queryIterator = queries.get(queryIdx).getQuery().entrySet().iterator();
			
			while(queryIterator.hasNext()) {
				Entry<String, String> entry = queryIterator.next();
				String type = getType(entry.getKey());
				type+=queryIdx;
				if (type.equals("unknownType"))
					continue;
				Action act = actionsHM.get(type);
				if (act == null) {
					act = new Action();
					act.setTimestamp(System.currentTimeMillis());
					act.setCategory(getCategory(entry.getKey()));
					act.setType(getType(entry.getKey()));

				} else {
					
				}
				String value = act.getValue() == null ? "": act.getValue();
				value += "Canvas"+queryIdx+" "+ entry.getValue() + " ";

				act.setValue(value);
				actionsHM.put(type, act);
			}
			
		}
		
		for (Action action: actionsHM.values()) {
			QueryEvent queryEvent = new QueryEvent();
			queryEvent.setTimestamp(action.getTimestamp());
			queryEvent.setCategory(getCategoryEnum(action.getCategory()));
			queryEvent.setType(action.getType());
			queryEvent.setValue(action.getValue());
			eventLog.addEventsItem(queryEvent);

		}
	}
	
	
	
	public static final String TXT = "txt";
		
	public static final String OBJECTS = "objects";
	
	public static final String MI_FILE_ANNOTATIONS = "mifile";
	
	public static final String VISUAL_FEATURES = "features";
	
	
	private String getCategory(String field) {
		String category;
		
		switch (field) {
		case "objects":
			category = "text";
			break;
			
		case "txt":
			category = "text";
			break;
			
		case "color":
			category = "sketch";
			break;
			
		case "colorTXT":
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
			
//		case "tern":
//			category = "text";
//			break;
//			
//		case "clip":
//			category = "text";
//			break;
			
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
			type = "localizedObject";
			break;
		
		case "txt":
			type = "localizedObject";
			break;
		
		case "color":
			type = "color";
			break;
			
		case "colorTXT":
			type = "color";
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
			
//		case "tern":
//			type = "concept";
//			break;
//			
//		case "clip":
//			type = "concept";
//			break;
			
		case "textual":
			type = "concept";
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
			type = "unknownType";
		}
		
		return type;
	}
	
	class QueryElement {
		
		private String field;
		private String value;
		
		public QueryElement(String field, String value) {
			super();
			this.field = field;
			this.value = value;
		}

		public String getField() {
			return field;
		}

		public String getValue() {
			return value;
		}
		
	}

}
