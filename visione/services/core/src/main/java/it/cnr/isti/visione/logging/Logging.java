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
import java.util.Set;

import com.google.gson.Gson;

import it.cnr.isti.visione.lucene.Fields;
import it.cnr.isti.visione.services.Settings;
import it.cnr.isti.visione.services.VisioneQuery;

public class Logging {
	
	private static final String TYPE = "submit";
	
	private Gson gson = new Gson();
	
	private File destFolder;
	
	private List<Query> queries = new ArrayList<>();
	private List<ResultSet> results = new ArrayList<>();
	private long currentTimeFilename;
	
	public Logging(File destFolder) {
		this.destFolder = destFolder;
		
	}
	
	public synchronized void savePreviousSessionLogs(String dresSessionId, long clientSubmissionTimestamp) throws IOException {
		if(queries.size()>0) {
			save("", -1, -1, dresSessionId, clientSubmissionTimestamp);
		}
	}
	
	public synchronized void save(String videoId, int frameNumber, long startTime, String dresSessionId, long clientSubmissionTimestamp) throws IOException {
		
		new Runnable() {
			
			@Override
			public void run() {
				synchronized (TYPE) {
					VisioneLogging log = new VisioneLogging();
					log.setType(TYPE);
					
					log.setSessionId(dresSessionId);
					
					//TO CHECK!
					log.setTimestamp(clientSubmissionTimestamp);
					log.setVideoId(videoId);
					//if (time != null)
					//	log.setVideoTime(time);
					if (frameNumber != -1)
						log.setFrameNum(frameNumber);
				    if (startTime != -1)
						log.setTimeNum(startTime);
					log.setQueries(queries);
					log.setResults(results);
					
					String json = gson.toJson(log);
//				
					
					if (destFolder != null) {
						currentTimeFilename = clientSubmissionTimestamp;
						try (BufferedWriter writer = new BufferedWriter(new FileWriter(new File(destFolder, currentTimeFilename + ".json")))) {
							writer.write(json);
						} catch (IOException e) {
							// TODO Auto-generated catch block
							e.printStackTrace();
						}
					}
					queries.clear();
					results.clear();
				}
				}
				
		}.run();
		
		
		//queries.clear();
		//results.clear();
	}
	
	public synchronized void saveResponse(String response) {
		new Runnable() {
			
			@Override
			public void run() {
				synchronized (TYPE) {
					if (destFolder != null) {
						try (BufferedWriter writer = new BufferedWriter(new FileWriter(new File(destFolder, currentTimeFilename + ".DRESresponse.txt")))) {
							writer.write(response);
						} catch (IOException e) {
							e.printStackTrace();
						}
					}
				}
				}
				
		}.run();
	}
	
	public synchronized void query2Log(String query, boolean simReorder, String resultset) throws IOException {
		Query queryObj = new Query(System.currentTimeMillis(), query);
		ResultSet queryResults = new ResultSet(resultset);
		queries.add(queryObj);
		results.add(queryResults);
	}
	

	
	
	public static final String TXT = "txt";
		
	public static final String OBJECTS = "objects";
	
	public static final String MI_FILE_ANNOTATIONS = "mifile";
	
	public static final String VISUAL_FEATURES = "features";

}
