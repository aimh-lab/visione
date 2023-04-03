package it.cnr.isti.visione.services;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;

import javax.inject.Singleton;
import javax.servlet.ServletContext;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.Consumes;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.FormParam;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.client.ResponseProcessingException;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import org.apache.lucene.queryparser.classic.ParseException;
import org.apache.lucene.search.TopDocs;

import com.google.gson.Gson;

import dev.dres.ApiException;
import it.cnr.isti.visione.logging.DRESClient;
//import it.cnr.isti.visione.logging.fake.DRESClient;
import it.cnr.isti.visione.logging.LogParserDRES;
import it.cnr.isti.visione.logging.Logging;
import it.cnr.isti.visione.logging.Tools;
import it.cnr.isti.visione.lucene.Fields;
import it.cnr.isti.visione.lucene.LucTextSearch;

/**
 * @author lucia
 *
 */
@Path("/VBSService")
@Singleton
public class VBSService {
	
	private Gson gson;

	private static final int K_MERGE = 200000;
	private DRESClient client;
	private static 	ObjectQueryPreprocessing objectPreprocessing;
	private static final String HYPERSETS = "/WEB-INF/hypersets.csv";
	private static final String VISIONE_CONF = "/WEB-INF/conf.properties";
	private static File LOGGING_FOLDER;
	private static File LOGGING_FOLDER_DRES;
	private static String MEMBER_ID;
	private static Boolean SEND_LOG_TO_DRES;
	private HashMap<String, LucTextSearch> datasetSearcher = new HashMap<>();
	private LogParserDRES dresLog; //saved at each query
	private Logging visioneLog; //saved at submission time and at each new session (if not empty)


	@Context
	private HttpServletRequest httpServletRequest;

	@Context
	public void setServletContext(ServletContext context) throws Exception {
		try (InputStream is = context.getResourceAsStream(HYPERSETS)) {
			objectPreprocessing = new ObjectQueryPreprocessing(is);
		}
		
		try (InputStream is = context.getResourceAsStream(VISIONE_CONF)) {
			Settings.init(is);
			LOGGING_FOLDER = new File(Settings.LOG_FOLDER);
			LOGGING_FOLDER_DRES = new File(Settings.LOG_FOLDER_DRES);
			MEMBER_ID=Settings.MEMBER_ID;
			SEND_LOG_TO_DRES=Settings.SEND_LOG_TO_DRES;
		}
		
		LucTextSearch.setPreprocessing(objectPreprocessing);
		LucTextSearch v3cSearcher = new LucTextSearch();
		v3cSearcher.openSearcher(Settings.LUCENE);
		datasetSearcher.put("v3c", v3cSearcher);
		datasetSearcher.put("v3c1", v3cSearcher);
		datasetSearcher.put("v3c2", v3cSearcher);
		
		LucTextSearch mvkSearcher = new LucTextSearch();
		mvkSearcher.openSearcher(Settings.LUCENE_MVK);
		datasetSearcher.put("mvk", mvkSearcher);
		
		gson = new Gson();
		if (!LOGGING_FOLDER.exists())
			LOGGING_FOLDER.mkdir();
		if (!LOGGING_FOLDER_DRES.exists())
			LOGGING_FOLDER_DRES.mkdir();
		dresLog = new LogParserDRES(LOGGING_FOLDER_DRES);
		visioneLog = new Logging(LOGGING_FOLDER);
		client = new DRESClient();
		
		System.out.println("started...");
	}

	@GET
	@Path("/test")
	@Consumes(MediaType.TEXT_PLAIN)
	@Produces(MediaType.TEXT_PLAIN)
	public String test() {
		return "Strunz!!!!";
	}

	@POST
	@Path("/testSubmitResult")
	@Consumes(MediaType.APPLICATION_JSON)
	@Produces(MediaType.TEXT_PLAIN)
	public String testSubmitResult(@FormParam("team") String team, @FormParam("video") String video, @FormParam("frame") String frame, @FormParam("shot") String shot) {
		System.out.println(team);
		System.out.println(video);
		System.out.println(frame);
		System.out.println(shot);
		return "it works";
	}
	
	@POST
	@Path("/testLogging")
	@Consumes(MediaType.APPLICATION_FORM_URLENCODED)
	@Produces(MediaType.TEXT_PLAIN)
	public String testLogging(@FormParam("iseq") String iseq) {
		System.out.println(iseq);
		return "it works";
	}
	
	
	@GET
	@Path("/init")
	@Consumes({ MediaType.TEXT_PLAIN })
	@Produces(MediaType.TEXT_PLAIN)
	public String init() {
		try {
			visioneLog.savePreviousSessionLogs(client.getSessionId(),System.currentTimeMillis()); //to prevent log 
		} catch (IOException e) {
			e.printStackTrace();
		}
		System.out.println("New Session Started");
		return "New Session Started";
	}
	
	private TopDocs hits;

	
	@POST
	@Path("/search")
	@Consumes(MediaType.APPLICATION_FORM_URLENCODED)
	@Produces(MediaType.TEXT_PLAIN)
	public String search(@FormParam("query") String query, @DefaultValue("-1") @FormParam("k") int k, @DefaultValue("false") @FormParam("simreorder") boolean simReorder, @DefaultValue("v3c") @FormParam("dataset") String dataset) {
		System.out.println(new Date() + " - " + httpServletRequest.getRemoteAddr() + " - " + query);
		
		int n_frames_per_row=dataset.equals("mvk")? 20:10;
		int maxRes=1500;//
		String response = "";
		if (k == -1)
			k = Settings.K;
		List<VisioneQuery> queries = QueryParser.getQueries(query);
		List<VisioneQuery> logQueries = QueryParser.getQueries(query);
		
		if (queries.size() > 1)
			k = K_MERGE;
		List<TopDocs> tabHits = new ArrayList<>();
		
		TopDocs hitsToReorder = null;
		if (simReorder)
			hitsToReorder = hits;
		
	
		for (int i = 0; i < queries.size(); i++) {
			System.out.println("^^^^^^^^^ TAB "+(i+1)+" ^^^^^^^^");
			VisioneQuery queryObj = queries.get(i);
			if (queryObj.getQuery().size() == 0)
				continue;
			try {
				if (queryObj.getQuery().containsKey("comboVisualSim")) {
					BlockingQueue<TopDocs> hits_tmp=new ArrayBlockingQueue<TopDocs>(3);

					hits_tmp.add(datasetSearcher.get(dataset).searchByID(queryObj.getQuery().get("comboVisualSim"), k, hitsToReorder));//search by GeM
					hits_tmp.add(datasetSearcher.get(dataset).searchByALADINid(queryObj.getQuery().get("comboVisualSim"), k, hitsToReorder));//search by Aladin
					hits_tmp.add(datasetSearcher.get(dataset).searchByCLIPID(queryObj.getQuery().get("comboVisualSim"), k, dataset));//search by Clip4Video
					TopDocs res = datasetSearcher.get(dataset).mergeResults(new ArrayList<TopDocs>(hits_tmp),k,1, false);
					log(res, query, logQueries, simReorder, dataset);
					return gson.toJson(datasetSearcher.get(dataset).sortByVideo(res, n_frames_per_row, maxRes));
				}
				else if (queryObj.getQuery().containsKey("vf")) {
					TopDocs res = datasetSearcher.get(dataset).searchByID(queryObj.getQuery().get("vf"), k, hitsToReorder);
					log(res, query, logQueries, simReorder, dataset);
					return gson.toJson(datasetSearcher.get(dataset).sortByVideo(res, n_frames_per_row, maxRes));
				}
				else if (queryObj.getQuery().containsKey("qbe")) {
					String features = FeatureExtractor.url2FeaturesUrl(queryObj.getQuery().get("qbe"));
					TopDocs res = datasetSearcher.get(dataset).searchByExample(features, k, hitsToReorder);
					log(res, query, logQueries, simReorder, dataset);
					return gson.toJson(datasetSearcher.get(dataset).sortByVideo(res,n_frames_per_row, maxRes));
				}
				else if (queryObj.getQuery().containsKey("aladinSim")) {
					TopDocs res =datasetSearcher.get(dataset).searchByALADINid(queryObj.getQuery().get("aladinSim"), k, hitsToReorder);
					log(res, query, logQueries, simReorder, dataset);
					return gson.toJson(datasetSearcher.get(dataset).sortByVideo(res,n_frames_per_row, maxRes));
				}
				else if (queryObj.getQuery().containsKey("clipSim")) {
					TopDocs res = datasetSearcher.get(dataset).searchByCLIPID(queryObj.getQuery().get("clipSim"), k, dataset);//TODO il k non viene usato e si potrebbe modificare usando il merge conhitsToReorder per fare una sorta di simn reorder 
					log(res, query, logQueries, simReorder, dataset);
					return gson.toJson(datasetSearcher.get(dataset).sortByVideo(res,n_frames_per_row, maxRes));
				}
				else {
					
					
					if(queryObj.getQuery().containsKey("textual")) {//we have a text query
						BlockingQueue<TopDocs> hits_tmp=new ArrayBlockingQueue<TopDocs>(3);
						String textQuery = queryObj.getQuery().get("textual");
						queryObj.getQuery().remove("textual");
						Boolean doALADIN=queryObj.getParameters().get("textualMode").indexOf("al") >= 0;
						Boolean doCLIPPONE=queryObj.getParameters().get("textualMode").indexOf("cl") >= 0;
						Boolean doCLIP=queryObj.getParameters().get("textualMode").indexOf("cv") >= 0;
						Boolean doAll=queryObj.getParameters().get("textualMode").indexOf("all") >= 0;
						if (doAll) {
							doALADIN = true;
							doCLIPPONE = true;
							doCLIP = true;
						}
						Boolean doOBJECTS=queryObj.getQuery().containsKey(Fields.OBJECTS);
						String objectquery="";
						
						List<Thread> threadedCombo = new ArrayList<>();
						
						if (doALADIN || doOBJECTS)  {
							if(doOBJECTS) {
								String preprocessed = objectPreprocessing.processing(queryObj.getQuery().get(Fields.OBJECTS), false);
								objectquery=CLIPExtractor.getObjectTxt4CLIP(preprocessed);
							}
							
							/*System.out.println("ALADIN");
							String features = ALADINExtractor.text2Features(textQuery, K_Q_ALADIN).trim();
							queryObj.getQuery().put(Fields.ALADIN, features);

						}else {
							queryObj.getQuery().remove(Fields.ALADIN);
						}
						
						hits_tmp.add(datasetSearcher.get(dataset).search(queryObj, k));//adding OBJECT and ALADIN (if applicable)
						*/
							Thread aladinThread = new Thread(new AladinSearchThreaded(hits_tmp, datasetSearcher.get(dataset), textQuery, queryObj, k));
							aladinThread.start();
							threadedCombo.add(aladinThread);
						}
						// CLip and Clippone query changes if objects are in the canvas. In such cases Aladin is used as well
						String clipQuery=textQuery+objectquery;							
						if (doCLIP)  {
							Thread clipThread = new Thread(new CLIPSearchThreaded(hits_tmp, datasetSearcher.get(dataset), clipQuery, dataset));
							clipThread.start();
							threadedCombo.add(clipThread);
							//hits_tmp.add(datasetSearcher.get(dataset).searchByCLIP(clipQuery, dataset)); //adding CLIP--nb CLIP is always added as first element in hits_tmp
						}
						if (doCLIPPONE)  {
							Thread clipponeThread = new Thread(new CLIPOneSearchThreaded(hits_tmp, datasetSearcher.get(dataset), clipQuery, dataset));
							clipponeThread.start();
							threadedCombo.add(clipponeThread);

							//hits_tmp.add(datasetSearcher.get(dataset).searchByCLIPOne(clipQuery, dataset)); //adding CLIP--nb CLIP is always added as first element in hits_tmp
						}

						for (Thread t: threadedCombo)
							t.join();
						tabHits.add(datasetSearcher.get(dataset).mergeResults(new ArrayList<TopDocs>(hits_tmp),k, 3, false));//merging lucene res with clip res and adding it to tabHits	

					}else {//here we need to call Lucene without text 
						tabHits.add(datasetSearcher.get(dataset).search(queryObj, k));
					}
											
					
					/*String objectClassesTxt=queryObj.getQuery().get(Fields.OBJECTS);
					if(objectClassesTxt!=null)
						queryObj.addQuery(Fields.OBJECTS, objectPrerocessing.processing(objectClassesTxt, true));*/
					

				}
			} catch (IOException | ParseException | org.apache.hc.core5.http.ParseException | InterruptedException e) {
				e.printStackTrace();
			}
			
		}
		System.out.println("^^^^^^^^^ RES ^^^^^^^^");
		try {
			if (tabHits.size() > 1) {
				hits = datasetSearcher.get(dataset).mergeResults(tabHits, Settings.K, 3, true);//LUCIA bug fixed(?) Settings.K instead of K
			}
			else if (tabHits.size() == 1) {
				hits = tabHits.get(0);
			}
			
			log(hits, query, logQueries, simReorder, dataset);
			
			
			response = gson.toJson(datasetSearcher.get(dataset).sortByVideo(hits,n_frames_per_row, maxRes));
			if (response == null)
				response = "";//new
//				response = gson.toJson(datasetSearcher.get(dataset).topDocs2SearchResults(hits));

		} catch (IOException e) {
			e.printStackTrace();
		}
		System.out.println("--End Java--");
		return response	;
	}
	
	
	/**
	 * Write Dres QueryResultLog, save it to a file without saving it)
	 * @param hits
	 * @param query
	 * @param queries
	 * @param simReorder
	 * @param dataset
	 */
	public void log(TopDocs hits, String query, List<VisioneQuery> queries, boolean simReorder, @DefaultValue("v3c") @FormParam("dataset") String dataset) {
		try {
			ArrayList<SearchResults> searchResults = datasetSearcher.get(dataset).topDocs2SearchResults(hits, 10000);
			String resLog = gson.toJson(searchResults);
			Long clientTimestamp=dresLog.query2Log(queries, simReorder, searchResults); 
			if(SEND_LOG_TO_DRES)
				client.dresSubmitLog(dresLog.getResultLog()); 
			dresLog.save(clientTimestamp,client.getSessionId(), MEMBER_ID);
			visioneLog.query2Log(query, simReorder, resLog); 
			
//			
		} catch (IOException | KeyManagementException | NumberFormatException | NoSuchAlgorithmException e1 ) {
			// TODO Auto-generated catch block
			e1.printStackTrace();
		}
	}
	
	@GET
	@Path("/log")
	@Consumes({ MediaType.TEXT_PLAIN })
	@Produces(MediaType.TEXT_PLAIN)
	public String log(@QueryParam("query") String query) {
		String response = "";
		System.out.println(new Date() + " - " + httpServletRequest.getRemoteAddr() + " - " + query);
		if (query != null && !query.trim().equals("")) {
//			disabled to avoid browsing logging
//			try {
//				log.query2Log(query);
//			} catch (IOException e1) {
				// TODO Auto-generated catch block
//				e1.printStackTrace();
//			}
		}
		return response;
	}
/*	
	@GET
	@Path("/toJSON")
	@Consumes({ MediaType.TEXT_PLAIN })
	@Produces(MediaType.TEXT_PLAIN)
	public String toJSON(@QueryParam("query") String query) {
		System.out.println(new Date() + " - " + httpServletRequest.getRemoteAddr() + " jsonify " + query);
		String response = "";
		try {
			if (query.startsWith("vf"))
				response = datasetSearcher.get(dataset).TopDocs2String(datasetSearcher.get(dataset).searchByID(query, K, null), K);
			else
				response = datasetSearcher.get(dataset).TopDocs2String(datasetSearcher.get(dataset).search(query, K, ""), K);
		} catch (IOException | ParseException e) {
			e.printStackTrace();
			return response;
		}
		return response;
	}
*/
	@GET
	@Path("/getText")
	@Consumes({ MediaType.TEXT_PLAIN })
	@Produces(MediaType.TEXT_PLAIN)
	public String getText(@QueryParam("id") String id, @QueryParam("field") String field, @DefaultValue("v3c") @QueryParam("dataset") String dataset) {

		String response = "";
		try {
			response = datasetSearcher.get(dataset).getTerms(id, field, false);
			if (field.equals(Fields.OBJECTS))
				response = response.replaceAll("4wc", "");
//			System.out.println(field + " ------------------RESPONSE " + response);

		} catch (IOException e) {
			e.printStackTrace();
			return response;
		}
		return response;
	}
	
	@GET
	@Path("/getField")
	@Consumes({ MediaType.TEXT_PLAIN })
	@Produces(MediaType.TEXT_PLAIN)
	public String getField(@QueryParam("id") String id, @QueryParam("field") String field, @DefaultValue("v3c") @QueryParam("dataset") String dataset) {

		String response = "";
		try {
			response = datasetSearcher.get(dataset).get(id, field);
//			System.out.println(field + " ------------------RESPONSE " + response);

		} catch (IOException e) {
			e.printStackTrace();
			return response;
		}
		return response;
	}

	@GET
	@Path("/getStartTime")
	@Consumes({ MediaType.TEXT_PLAIN })
	@Produces(MediaType.TEXT_PLAIN)
	public String getStartTime(@QueryParam("id") String id, @DefaultValue("v3c") @QueryParam("dataset") String dataset) {
		String response = "";
		try {
			response = datasetSearcher.get(dataset).get(id, Fields.START_TIME);
//			System.out.println(Fields.START_TIME + " ------------------RESPONSE " + response);
//			System.out.println(getKeyframeNumber(id));
			

		} catch (IOException e) {
			e.printStackTrace();
			return response;
		}
		return response;
	}
	
	@GET
	@Path("/getEndTime")
	@Consumes({ MediaType.TEXT_PLAIN })
	@Produces(MediaType.TEXT_PLAIN)
	public String getEndTime(@QueryParam("id") String id, @DefaultValue("v3c") @QueryParam("dataset") String dataset) {
		String response = "";
		try {
			response = datasetSearcher.get(dataset).get(id, Fields.END_TIME);
//			System.out.println(Fields.START_TIME + " ------------------RESPONSE " + response);
//			System.out.println(getKeyframeNumber(id));
			

		} catch (IOException e) {
			e.printStackTrace();
			return response;
		}
		return response;
	}
	
	@GET
	@Path("/getMiddleTimestamp")
	@Consumes({ MediaType.TEXT_PLAIN })
	@Produces(MediaType.TEXT_PLAIN)
	public String getMiddleTimestamp(@QueryParam("id") String id, @DefaultValue("v3c") @QueryParam("dataset") String dataset) {
		String response = "";
		try {
			response = datasetSearcher.get(dataset).get(id, Fields.MIDDLE_TIME);
//			System.out.println(Fields.START_TIME + " ------------------RESPONSE " + response);
//			System.out.println(getKeyframeNumber(id));
			

		} catch (IOException e) {
			e.printStackTrace();
			return response;
		}
		return response;
	}
	
	@GET
	@Path("/getKeyframeNumber")
	@Consumes({ MediaType.TEXT_PLAIN })
	@Produces(MediaType.TEXT_PLAIN)
	public String getKeyframeNumber(@QueryParam("id") String id, @DefaultValue("v3c") @QueryParam("dataset") String dataset) {
		String response = "";
		try {
			response = datasetSearcher.get(dataset).getTerms(id, Fields.START_FRAME, false);
//			System.out.println(Fields.START_FRAME + " ------------------RESPONSE " + response);
		} catch (IOException e) {
			e.printStackTrace();
			return response;
		}
		return response.trim();
	}
	
	@GET
	@Path("/getAllVideoKeyframes")
	@Consumes({ MediaType.TEXT_PLAIN })
	@Produces(MediaType.APPLICATION_JSON)
	public String getAllVideoKeyframes(@QueryParam("videoId") String videoId, @DefaultValue("v3c") @QueryParam("dataset") String dataset) {
		String response = "";
		try {
			List<String> keyframes = datasetSearcher.get(dataset).getAllVideoKeyframes(videoId);
			response = gson.toJson(keyframes);

//			System.out.println(Fields.START_FRAME + " ------------------RESPONSE " + response);
		} catch (IOException e) {
			e.printStackTrace();
			return response;
		} catch (ParseException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		return response;
	}


    	
    
	@GET
	@Path("/submitResult")
	@Consumes({ MediaType.TEXT_PLAIN })
	@Produces(MediaType.TEXT_PLAIN)
	public String submitResult(@QueryParam("videoid") String videoIdParam, @QueryParam("time") String videoAtTime,  @QueryParam("id") String keyframeIdParam, @DefaultValue("false") @QueryParam("isAVS") boolean isAVS, @DefaultValue("and") @QueryParam("occur") String occur, @DefaultValue("false") @QueryParam("simreorder") boolean simreorder,  @QueryParam("dataset") String dataset) {
		long clientSubmissionTimestamp = System.currentTimeMillis();
		String response = "";
		System.out.println("isAVS " + isAVS );
		String videoId = videoIdParam;
		String time = null;
		int middleFrame = -1;
		String value=null;
		if (keyframeIdParam != null) {
			try {
				middleFrame = Integer.parseInt(datasetSearcher.get(dataset).get(keyframeIdParam, Fields.MIDDLE_FRAME));
				if(dataset.equals("mvk"))
					time=Tools.convertTimeToVBSFormat(datasetSearcher.get(dataset).get(keyframeIdParam, Fields.MIDDLE_TIME));
			} catch (IOException e) {
				e.printStackTrace();
			}
		} else {
			videoId = videoIdParam;
			time = Tools.convertTimeToVBSFormat(videoAtTime);
		}
			
				
		if (time != null) {
			value=time;
			boolean exit = false;
			int counter = 0;
			while(!exit) {
				try {
					response = client.dresSubmitResultByTime(videoId, time);
					exit = true;
				} catch (ApiException e) {
					System.err.println("Error with DRES authentication. Trying to init DRES clien again...");
					if (counter++ <= 3 )
						client = new DRESClient();
					else {
						System.err.println("Error unable to initialize DRES client");
						exit = true;
					}
				}
			}
			
		}else {
			
			if (middleFrame != -1) {
				value=Integer.toString(middleFrame);
				boolean exit = false;
				int counter = 0;
				while(!exit) {
					try {
						response = client.dresSubmitResultByFrameNumber(videoId, middleFrame);
						exit = true;
					} catch (ApiException e) {
						System.err.println("Error with DRES authentication. Trying to init DRES clien again...");
						if (counter++ <= 3 )
							client = new DRESClient();
						else {
							System.err.println("Error unable to initialize DRES client");
							exit = true;
						}
					}
				}
			}			
		}
		visioneLog.saveResponse(response);
		System.out.println(Settings.TEAM_ID + "," + videoId + "," + time);
				
		//saving logs
		try {
			visioneLog.save(videoId, middleFrame, time, client.getSessionId(),clientSubmissionTimestamp);
			dresLog.save_submission_log(clientSubmissionTimestamp, client.getSessionId(), MEMBER_ID, videoId+": "+value );
		} catch (IOException | NumberFormatException e1) {
			e1.printStackTrace();
			System.out.println(Settings.MEMBER_ID + "," + videoId + "," + time);
		}

		return response;
	}
	
	@GET
	@Path("/setSimilarity")
	@Consumes({ MediaType.TEXT_PLAIN })
	@Produces(MediaType.TEXT_PLAIN)
	public String setSimilarity(@QueryParam("txtSim") String txtSim, @QueryParam("mifileSim") String mifileSim, @QueryParam("objSim") String objSim, @QueryParam("defaultSim") String defaultSim) {
		//datasetSearcher.get(dataset).setFieldSimilarities(txtSim, mifileSim, objSim, defaultSim);
		//rmacdatasetSearcher.get(dataset).setFieldSimilarities(txtSim, mifileSim, objSim, defaultSim);
		return txtSim + "," +  mifileSim + "," + objSim + "," + defaultSim;
	}
}
