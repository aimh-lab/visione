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
import org.openapitools.client.model.QueryEventCategory;
import org.openapitools.client.model.QueryEventLog;
import org.openapitools.client.model.RankedAnswer;
import org.openapitools.client.model.ApiClientAnswer;
import org.openapitools.client.model.QueryResultLog;
import org.openapitools.client.model.CurrentTime;
import dev.dres.client.StatusApi;

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

	// public synchronized void save() throws IOException {
	// if (destFolder != null) {
	// long time = System.currentTimeMillis();
	// if (getResultLog() != null) {
	// try (BufferedWriter writer = new BufferedWriter(new FileWriter(new
	// File(destFolder, time + ".resultLog.json")))) {
	// writer.write(getResultLog().toString());
	// }
	// }
	//
	// }
	// }

	public synchronized void save(long timestamp, String sessionid, String user) throws IOException {
		Gson gson = new Gson();
		String fn = timestamp + "_" + sessionid + "_" + user;
		if (destFolder != null) {
			if (getResultLog() != null) {
				try (BufferedWriter writer = new BufferedWriter(new FileWriter(new File(destFolder, fn + ".json")))) {
					// writer.write(getResultLog().toString());
					writer.write(gson.toJson(getResultLog()));
				}
			}

		}
	}

	public synchronized void save_submission_log(long timestamp, String sessionid, String user, String value) throws IOException {
		Gson gson = new Gson();
		String fn = timestamp + "_" + sessionid + "_" + user + "_SUBMISSION";
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

	public synchronized long query2Log(List<VisioneQuery> queries, SearchResults[] resultset) throws IOException {
		long clientTimestamp = System.currentTimeMillis();
		return query2Log(queries, resultset, clientTimestamp);
	}

	/**
	 * Create a DRES QueryResultLog event given the VISIONE query and results
	 *
	 * @param queries   Lucene queries used to get the current resultset
	 * @param resultSet ranked SearchResults
	 * @return clientTimestamp timestamp of the log
	 * @throws IOException
	 */
	public synchronized long query2Log(List<VisioneQuery> queries, SearchResults[] resultSet, long clientTimestamp)
			throws IOException {
		int rank = 1;
		this.resultLog = new QueryResultLog();
		resultLog.setTimestamp(clientTimestamp);
		resultLog.setResultSetAvailability("Top10000");
		resultLog.setSortType("rankingModel");
		// creating result list
		if (resultSet != null) {
			for (int i = 0; i < resultSet.length; i++) {

				SearchResults res = resultSet[i];
				Long middletime= res.getMiddleTime();
				ApiClientAnswer answer= new ApiClientAnswer().mediaItemName(res.getVideoId()).start(middletime).end(middletime);
				RankedAnswer resultItem = new RankedAnswer().rank(rank++).answer(answer);
				//resultItem.setItem(res.getVideoId());
				//resultItem.setFrame(res.getMiddleFrame());
				//resultItem.setRank(rank++);
				//resultItem.setScore((double) res.score); //score not supported anymore
				resultLog.addResultsItem(resultItem);
			}
		}

		// creating event list
		for (int queryIdx = 0; queryIdx < queries.size(); queryIdx++) {
			Iterator<Entry<String, String>> queryIterator = queries.get(queryIdx).getQuery().entrySet().iterator();
			Iterator<Entry<String, String>> queryParametersIterator = queries.get(queryIdx).getParameters().entrySet()
					.iterator();
			String queryParam = ""; // string containing query parameter
			while (queryParametersIterator.hasNext()) {
				Entry<String, String> entry = queryParametersIterator.next();
				queryParam += " > " + entry.getKey() + "=" + entry.getValue();
			}
			String temporaltTxT = "";
			if (queries.size() > 1)
				temporaltTxT = " > Temporal_query " + (queryIdx + 1);
			while (queryIterator.hasNext()) {
				Entry<String, String> entry = queryIterator.next();
				String keyField = entry.getKey();
				String value = entry.getValue();
				QueryEvent queryEvent = new QueryEvent();
				queryEvent.setTimestamp(clientTimestamp);
				queryEvent.setCategory(getCategoryEnum(getCategory(keyField)));
				queryEvent.setType(getType(keyField) + getSubType(keyField)); // TODO see if in DRES they have added a subtype
				queryEvent.setValue(value + temporaltTxT + queryParam); // TODO see if in DRES they have added an additional fieldto store query param and temporal info
				resultLog.addEventsItem(queryEvent);
			}
		}
		return clientTimestamp;
	}

	public static final String TXT = "txt";

	public static final String OBJECTS = "objects";

	public static final String MI_FILE_ANNOTATIONS = "mifile";

	public static final String VISUAL_FEATURES = "features";

	private String getCategory(String field) { // category dictionary
		String category;

		switch (field) {
			case "objects":
				category = "text";
				break;

			case "txt":
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

			case "aladinSim":
				category = "image";
				break;

			case "clipSim":
				category = "image";
				break;

			// case "explicitsort":
			// category = "browsing";
			// break;

			// case "rankedlist":
			// category = "browsing";
			// break;

			case "videoplayer":
				category = "browsing";
				break;

			case "videosummary":
				category = "browsing";
				break;

			case "translate":
				category = "service";

			case "speach2text":
				category = "service";

			default:
				category = "unknownCategory";
		}
		return category;
	}

	private QueryEventCategory getCategoryEnum(String field) {
		QueryEventCategory category;

		switch (field) {
			case "text":
				category = QueryEventCategory.TEXT;
				break;

			case "sketch":
				category = QueryEventCategory.SKETCH;
				break;

			case "filter":
				category = QueryEventCategory.FILTER;
				break;

			case "image":
				category = QueryEventCategory.IMAGE;
				break;

			case "browsing":
				category = QueryEventCategory.BROWSING;
				break;

			default:
				category = QueryEventCategory.OTHER;
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

			case "vf":
				type = "globalFeatures";
				break;

			case "qbe":
				type = "globalFeatures";
				break;

			case "aladinSim":
				type = "globalFeatures";
				break;

			case "clipSim":
				type = "globalFeatures";
				break;

			case "textual":
				type = "jointEmbedding";
				break;

			// case "explicitsort":
			// type = "explicitSort";
			// break;

			// case "rankedlist":
			// type = "rankedList";
			// break;

			case "videosummary":
				type = "videoSummary";
				break;

			case "videoplayer":
				type = "videoPlayer";
				break;

			case "translate":
				type = "translate";

			case "speach2text":
				type = "speach2text";

			default:
				type = ""; // unknownType
		}

		return type;
	}

	private String getSubType(String field) {
		String subtype;

		switch (field) {
			case "objects":
				subtype = ">classes";
				break;

			case "txt":
				subtype = ">position";
				break;

			case "vf":
				subtype = ">image similarity ";
				break;

			case "qbe":
				subtype = ">image similarity from URL of an image ";
				break;

			case "aladinSim":
				subtype = ">sematic similarity (ALADIN)";
				break;

			case "clipSim":
				subtype = ">sematic video similarity (CLIP)";
				break;

			case "translate":
				subtype = ">SeamlessM4T";

			case "speach2text":
				subtype = ">Whisper";

			default:
				subtype = "";
		}

		return subtype;
	}

	// class QueryElement {
	//
	// private String field;
	// private String value;
	//
	// public QueryElement(String field, String value) {
	// super();
	// this.field = field;
	// this.value = value;
	// }
	//
	// public String getField() {
	// return field;
	// }
	//
	// public String getValue() {
	// return value;
	// }
	//
	// }

}
