package it.cnr.isti.visione.services;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.lang.reflect.Type;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentSkipListMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.Collectors;
import java.util.stream.Stream;

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
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;

import org.apache.lucene.queryparser.classic.ParseException;
import org.apache.lucene.search.TopDocs;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonSerializationContext;
import com.google.gson.JsonSerializer;

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
@Path("/")
@Singleton
public class VBSService {

	private Gson gson;

	private static final int K_MERGE = 200000;
	private DRESClient client;
	private static ObjectQueryPreprocessing objectPreprocessing;
	private static final String HYPERSETS = "/WEB-INF/hypersets.csv";
	private static final String VISIONE_CONF = "/data/config.yaml";
	private static final String MAPPING2LSCID_FN = "/data/mapping2LSCid.csv";
	private static Map<String, String> MAPPING2LSCID;
	// private static File LOGGING_FOLDER;
	private static File LOGGING_FOLDER_DRES;
	private static String MEMBER_ID;
	private static Boolean SEND_LOG_TO_DRES;
	private LucTextSearch searcher = new LucTextSearch();
	private LogParserDRES dresLog; // saved at each query
	// private Logging visioneLog; //saved at submission time and at each new session (if not empty)

	public Map<String, String> getMapping2LscId(InputStream is) {
		Map<String, String> hm = new HashMap<>();
		try (BufferedReader reader = new BufferedReader(new InputStreamReader(is))) {
			String line = null;
			while ((line = reader.readLine()) != null) {
				String[] parts = line.split(",");
				String key = parts[0];
                String idLSC = parts[1];
				//remove space in the idLSC
				idLSC=idLSC.replaceAll(" ", "");
				hm.put(key, idLSC);
			}
		} catch (FileNotFoundException e) {
			e.printStackTrace();
		} catch (IOException e) {
			e.printStackTrace();
		}
		return hm ;
	}

	@Context
	private HttpServletRequest httpServletRequest;

	@Context
	public void setServletContext(ServletContext context) throws Exception {
		try (InputStream is = context.getResourceAsStream(HYPERSETS)) {
			objectPreprocessing = new ObjectQueryPreprocessing(is);
		}

		File configFile = new File(VISIONE_CONF);
		try (InputStream is = new FileInputStream(configFile)) {
			Settings.init(is);
		}
		
		try (InputStream is = new FileInputStream(MAPPING2LSCID_FN)) {
			MAPPING2LSCID=getMapping2LscId(is);//TODO check it
		}

		// LOGGING_FOLDER = new File(Settings.LOG_FOLDER);
		LOGGING_FOLDER_DRES = new File(Settings.LOG_FOLDER_DRES);
		MEMBER_ID = Settings.MEMBER_ID;
		SEND_LOG_TO_DRES = Settings.SEND_LOG_TO_DRES;

		LucTextSearch.setPreprocessing(objectPreprocessing);
		searcher.openSearcher(Settings.LUCENE);
		SearchResults.searcher = searcher.s;

		// gson = new Gson();
		gson = new GsonBuilder()
				.registerTypeAdapter(SearchResults.class, new JsonSerializer<SearchResults>() {
					@Override
					public JsonElement serialize(SearchResults src, Type typeOfSrc, JsonSerializationContext context) {
						JsonObject obj = new JsonObject();
						obj.addProperty("imgId", src.getImgId());
						obj.addProperty("videoId", src.getVideoId());
						obj.addProperty("score", src.score);
						obj.addProperty("middleFrame", src.getMiddleFrame());
						// obj.addProperty("middleTime", src.getMiddleTime());
						return obj;
					}
				})
				.create();
		// if (!LOGGING_FOLDER.exists())
		// LOGGING_FOLDER.mkdir();
		if (!LOGGING_FOLDER_DRES.exists())
			LOGGING_FOLDER_DRES.mkdir();
		dresLog = new LogParserDRES(LOGGING_FOLDER_DRES);
		// visioneLog = new Logging(LOGGING_FOLDER);
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

	@GET
	@Path("/ping")
	@Consumes(MediaType.TEXT_PLAIN)
	@Produces(MediaType.TEXT_PLAIN)
	public String ping() {
		return "pong";
	}

	private SearchResults[] lastHits;

	@POST
	@Path("/search")
	@Consumes(MediaType.APPLICATION_FORM_URLENCODED)
	@Produces(MediaType.TEXT_PLAIN)
	public String search(
			@FormParam("query") String query,
			@DefaultValue("-1") @FormParam("k") int k,
			@DefaultValue("false") @FormParam("simreorder") boolean simReorder,
			@DefaultValue("10") @FormParam("n_frames_per_row") int n_frames_per_row,
			@DefaultValue("hour") @FormParam("sortBy") String sortBy,
			//@DefaultValue("true") @FormParam("sortbyvideo") boolean sortByVideo,
			@DefaultValue("1500") @FormParam("maxres") int maxRes,
			@DefaultValue("lucia") @FormParam("fusion") String fusionMode) {
		System.out.println(new Date() + " - " + httpServletRequest.getRemoteAddr() + " - " + query.substring(0, Math.min(100, query.length())));
		String response = "";
		if (k == -1)
			k = Settings.K;
		int kMerge = k;
		List<VisioneQuery> queries = QueryParser.getQueries(query);
		List<VisioneQuery> logQueries = QueryParser.getQueries(query);

		if (queries.size() > 1)
			kMerge = K_MERGE;
		List<SearchResults[]> tabHits = new ArrayList<>();

		SearchResults[] hitsToReorder = null;
		if (simReorder)
			hitsToReorder = lastHits;

		for (int i = 0; i < queries.size(); i++) {
			System.out.println("--------------------------------");
			System.out.println("^^^^^^^^^ TAB " + (i + 1) + " ^^^^^^^^");
			System.out.println("--------------------------------");
			VisioneQuery queryObj = queries.get(i);
			if (queryObj.getQuery().size() == 0)
				continue;
			try {
				if (queryObj.getQuery().containsKey("comboVisualSim")) {
					String queryId = queryObj.getQuery().get("comboVisualSim");
					TopDocs topDocsToReorder = searcher.searchResults2TopDocs(hitsToReorder);
					List<Callable<SearchResults[]>> searches = new ArrayList<>(3);

					searches.add(new InternalSearch("dinov2", searcher).setQueryByID(queryId, k, topDocsToReorder));
					searches.add(new InternalSearch("aladin", searcher).setQueryByID(queryId, k, topDocsToReorder));
					searches.add(new ExternalSearch("clip2video").setQueryByID(queryId, k));

					ExecutorService executor = Executors.newFixedThreadPool(searches.size());
					List<Future<SearchResults[]>> futures = executor.invokeAll(searches);

					// gather results as SearchResults[]
					List<SearchResults[]> hits = futures.stream().map(f -> {
						try { return f.get(); } catch (InterruptedException | ExecutionException e) {
							e.printStackTrace();
							return null;
						}
					}).collect(Collectors.toList());

					SearchResults[] searchResults = searcher.mergeResults(hits, k, false, fusionMode);

					log(searchResults, query, logQueries); // logging query and search results

					if (sortBy.contains("hour"))
						searchResults = searcher.sortByVideo(searchResults, n_frames_per_row, maxRes);
					else
						if (sortBy.contains("day"))
							searchResults = searcher.sortByDay(searchResults, n_frames_per_row, maxRes);
						else
							searchResults = Arrays.copyOfRange(searchResults, 0, Math.min(searchResults.length, maxRes));

					return gson.toJson(searchResults);
				} else if (queryObj.getQuery().containsKey("vf")) {
					String queryId = queryObj.getQuery().get("vf");
					TopDocs topDocsToReorder = searcher.searchResults2TopDocs(hitsToReorder);

					SearchResults[] searchResults = new InternalSearch("dinov2", searcher).searchByID(queryId, k, topDocsToReorder);

					log(searchResults, query, logQueries); // logging query and search results

					if (sortBy.contains("hour"))
						searchResults = searcher.sortByVideo(searchResults, n_frames_per_row, maxRes);
					else
						if (sortBy.contains("day"))
							searchResults = searcher.sortByDay(searchResults, n_frames_per_row, maxRes);
						else
							searchResults = Arrays.copyOfRange(searchResults, 0, Math.min(searchResults.length, maxRes));


					return gson.toJson(searchResults);
				} else if (queryObj.getQuery().containsKey("qbe")) {
					String featureName = "dinov2";  // FIXME: use the feature name from the query
					String queryString = queryObj.getQuery().get("qbe");
					FeatureExtractor extractor = new FeatureExtractor(featureName);
					Float[] features = null;

					if (queryString.startsWith("http")) {
						features = extractor.extractFromUrl(queryString);
					} else if (queryString.startsWith("data:image")) {
						features = extractor.extractFromImage(queryString);
					} else {
						System.out.println("Invalid query: " + queryString.substring(0, Math.min(50, queryString.length())) + "...");
						return null;
					}

					TopDocs topDocsToReorder = searcher.searchResults2TopDocs(hitsToReorder);
					// FIXME: choose internal or external search based on the feature name and configuration
					InternalSearch is = new InternalSearch(featureName, searcher);
					SearchResults[] searchResults = is.searchByVector(features, k, topDocsToReorder);

					log(searchResults, query, logQueries); // logging query and search results

					if (sortBy.contains("hour"))
						searchResults = searcher.sortByVideo(searchResults, n_frames_per_row, maxRes);
					else
						if (sortBy.contains("day"))
							searchResults = searcher.sortByDay(searchResults, n_frames_per_row, maxRes);
						else
							searchResults = Arrays.copyOfRange(searchResults, 0, Math.min(searchResults.length, maxRes));


					return gson.toJson(searchResults);
				} else if (queryObj.getQuery().containsKey("aladinSim")) {
					String queryId = queryObj.getQuery().get("aladinSim");
					TopDocs topDocsToReorder = searcher.searchResults2TopDocs(hitsToReorder);

					SearchResults[] searchResults = new InternalSearch("aladin", searcher).searchByID(queryId, k, topDocsToReorder);

					log(searchResults, query, logQueries); // logging query and search results

					if (sortBy.contains("hour"))
						searchResults = searcher.sortByVideo(searchResults, n_frames_per_row, maxRes);
					else
						if (sortBy.contains("day"))
							searchResults = searcher.sortByDay(searchResults, n_frames_per_row, maxRes);
						else
							searchResults = Arrays.copyOfRange(searchResults, 0, Math.min(searchResults.length, maxRes));


					return gson.toJson(searchResults);
				} else if (queryObj.getQuery().containsKey("clipSim")) {
					String queryId = queryObj.getQuery().get("clipSim");
					SearchResults[] searchResults = new ExternalSearch("clip-laion").searchByID(queryId, k);

					if (hitsToReorder != null) {  // approximate reordering of the previous results by merging them with the new ones
						List<SearchResults[]> hitsToMerge = Arrays.asList(searchResults, hitsToReorder);
						searchResults = searcher.mergeResults(hitsToMerge, k, false, fusionMode);
					}

					log(searchResults, query, logQueries); // logging query and search results

					if (sortBy.contains("hour"))
						searchResults = searcher.sortByVideo(searchResults, n_frames_per_row, maxRes);
					else
						if (sortBy.contains("day"))
							searchResults = searcher.sortByDay(searchResults, n_frames_per_row, maxRes);
						else
							searchResults = Arrays.copyOfRange(searchResults, 0, Math.min(searchResults.length, maxRes));

					return gson.toJson(searchResults);
				} else {
					if (queryObj.getQuery().containsKey("textual")) {// we have a text query
						String textQuery = queryObj.getQuery().remove("textual");
						String textualMode = queryObj.getParameters().get("textualMode");
						System.out.println("textualMode: " + textualMode);

						long elapsed = -System.currentTimeMillis();
						List<Callable<SearchResults[]>> searches = new ArrayList<>();

						Boolean doOBJECTS = queryObj.getQuery().containsKey(Fields.OBJECTS);
						if (doOBJECTS) {
							// If we have objects, textual queries are expanded:
							// - an ALADIN search is performed as well
							searches.add(new InternalSearch("aladin", searcher).setQueryByText(textQuery, kMerge));

							// - CLIP-based queries are expanded with the objects
							String preprocessed = objectPreprocessing.processing(queryObj.getQuery().get(Fields.OBJECTS), false);
							String clipQuery = textQuery + ObjectQueryPreprocessing.getObjectTxt4CLIP(preprocessed);
							if (textualMode.equals("all")) {
								searches.add(new ExternalSearch("clip-laion").setQueryByText(clipQuery, k));
								searches.add(new ExternalSearch("clip2video").setQueryByText(clipQuery, k));
							} else if (textualMode.contains("clip")) {
								searches.add(new ExternalSearch(textualMode).setQueryByText(clipQuery, k));
							} else { // non-clip textual mode, leave it as it is for now
								searches.add(new ExternalSearch(textualMode).setQueryByText(textQuery, k));
							}
						} else {
							// If we don't have objects, textual queries are performed as usual
							if (textualMode.equals("all")) {
								searches.add(new InternalSearch("aladin", searcher).setQueryByText(textQuery, k));
								searches.add(new ExternalSearch("clip-laion").setQueryByText(textQuery, k));
								searches.add(new ExternalSearch("clip2video").setQueryByText(textQuery, k));
							} else if (textualMode.equals("aladin")) {
								searches.add(new InternalSearch(textualMode, searcher).setQueryByText(textQuery, k));
							} else {
								searches.add(new ExternalSearch(textualMode).setQueryByText(textQuery, k));
							}
						}

						// concurrent execution of the searches
						ExecutorService executor = Executors.newFixedThreadPool(searches.size());
						List<Future<SearchResults[]>> futures = executor.invokeAll(searches);

						// gather results as SearchResults[]
						List<SearchResults[]> hits = futures.stream().map(f -> {
							try { return f.get(); } catch (InterruptedException | ExecutionException e) {
								e.printStackTrace();
								return null;
							}
						}).collect(Collectors.toList());

						elapsed += System.currentTimeMillis();
						System.out.println("*** all searches: " + elapsed + "ms");

						// merge results
						SearchResults[] mergedResults = searcher.mergeResults(hits, k, false, fusionMode);
						tabHits.add(mergedResults);

					} else {// here we need to call Lucene without text
						tabHits.add(searcher.search(queryObj, kMerge)); // in this case the search results are already populated
					}
				}
			} catch (IOException | ParseException | InterruptedException e) {
				e.printStackTrace();
			}

		}
		System.out.println("^^^^^^^^^ RES ^^^^^^^^");
		try {
			if (tabHits.size() > 1) {
				lastHits = searcher.mergeResults(tabHits, Settings.K, true, fusionMode);
			} else if (tabHits.size() == 1) {
				lastHits = tabHits.get(0);
			}

			log(lastHits, query, logQueries); // logging query and search results

			SearchResults[] hitsToReturn;
			if (sortBy.contains("hour"))
				hitsToReturn = searcher.sortByVideo(lastHits, n_frames_per_row, maxRes);
			else
				if (sortBy.contains("day"))
					hitsToReturn = searcher.sortByDay(lastHits, n_frames_per_row, maxRes);
				else
					hitsToReturn = Arrays.copyOfRange(lastHits, 0, Math.min(lastHits.length, maxRes));

			long elapsed = -System.currentTimeMillis();
			Arrays.stream(hitsToReturn).parallel().map(sr -> sr.populate());
			elapsed += System.currentTimeMillis();
			System.out.println("*** Pre-populate: " + elapsed + "ms");

			System.out.println("*** Starting Gson ...");
			elapsed = -System.currentTimeMillis();
			response = gson.toJson(hitsToReturn);
			elapsed += System.currentTimeMillis();
			System.out.println("*** gson.toJson: " + elapsed + "ms");

			if (response == null)
				response = "";

		} catch (IOException e) {
			e.printStackTrace();
		}
		System.out.println("--End Java--");
		return response;
	}

	/**
	 * Write Dres QueryResultLog, save it to a file
	 *
	 * @param searchResults
	 * @param query
	 * @param queries
	 */
	public void log(SearchResults[] searchResults, String query, List<VisioneQuery> queries) {
		if (!Settings.SAVE_LOGS) {
			System.out.print("*** log NOT saved and sent...");
			return;
		}
		// SearchResults[] sr = Arrays.copyOf(searchResults); // FIXME
		new Thread(
				new Runnable() {
					@Override
					public void run() {
						try {
							long elapsed = -System.currentTimeMillis();
							Long clientTimestamp = dresLog.query2Log(queries, searchResults);
							if (SEND_LOG_TO_DRES){
								System.out.print("*** Sending log to DRES...");
								client.dresSubmitLog(dresLog.getResultLog());
							}else{
								System.out.print("*** log NOT sent to DRES...");
							}

							dresLog.save(clientTimestamp, client.getSessionId(), MEMBER_ID);
							elapsed += System.currentTimeMillis();
							System.out.println("*** Log saved: " + elapsed + "ms");
						} catch (IOException | KeyManagementException | NumberFormatException | NoSuchAlgorithmException e) {
							System.out.println("Error in saving logging");
							e.printStackTrace();
						}
					}
				}).start();
	}

	@POST
	@Path("/log")
	@Consumes({ MediaType.APPLICATION_FORM_URLENCODED })
	@Produces(MediaType.TEXT_PLAIN)
	public String log(@FormParam("query") String query) { // TODO fix this also in the UI to log Browsing and translate
		System.out.println("Logging service");
		String response = "logging service";
		List<VisioneQuery> logQueries = QueryParser.getQueries(query);
		log(null, query, logQueries);
		return response;
	}

	@GET
	@Path("/getText")
	@Consumes({ MediaType.TEXT_PLAIN })
	@Produces(MediaType.TEXT_PLAIN)
	public String getText(@QueryParam("id") String id, @QueryParam("field") String field) {

		String response = "";
		try {
			response = searcher.getTerms(id, field, false);
			if (field.equals(Fields.OBJECTS))
				response = response.replaceAll("4wc", "");
			// System.out.println(field + " ------------------RESPONSE " + response);

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
	public String getStartTime(@QueryParam("id") String id) {
		String response = "";
		try {
			response = searcher.get(id, Fields.START_TIME);
			// System.out.println(Fields.START_TIME + " ------------------RESPONSE " + response);
			// System.out.println(getKeyframeNumber(id));

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
	public String getEndTime(@QueryParam("id") String id) {
		String response = "";
		try {
			response = searcher.get(id, Fields.END_TIME);
			// System.out.println(Fields.START_TIME + " ------------------RESPONSE " + response);
			// System.out.println(getKeyframeNumber(id));

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
	public String getMiddleTimestamp(@QueryParam("id") String id) {
		String response = "";
		try {
			response = searcher.get(id, Fields.MIDDLE_TIME);
			// System.out.println(Fields.START_TIME + " ------------------RESPONSE " + response);
			// System.out.println(getKeyframeNumber(id));

		} catch (IOException e) {
			e.printStackTrace();
			return response;
		}
		return response;
	}

	@GET
	@Path("/getAllVideoKeyframes")
	@Consumes({ MediaType.TEXT_PLAIN })
	@Produces(MediaType.APPLICATION_JSON)
	public String getAllVideoKeyframes(@QueryParam("videoId") String videoId) {
		String response = "";
		try {
			List<String> keyframes = searcher.getAllVideoKeyframes(videoId);
			response = gson.toJson(keyframes);

			// System.out.println(Fields.START_FRAME + " ------------------RESPONSE " + response);
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
	public String submitResult(@DefaultValue("kis") @QueryParam("taskType") String taskTypeParam,  @QueryParam("videoid") String videoIdParam, @QueryParam("id") String keyframeIdParam, @QueryParam("textAnswer") String textAnswer, @QueryParam("time") String videoAtTime) {

		long clientSubmissionTimestamp = System.currentTimeMillis();
		String response = "";
		String taskType = taskTypeParam;
		String videoId = videoIdParam;
		String keyframeId = keyframeIdParam;
		// int middleFrame = -1;
		long value = -1;
		System.out.println("Submitting - task: " + taskType);
		String lscID="";
		if (!taskType.equals("qa")) {
			if (keyframeId != null) {
				lscID=MAPPING2LSCID.get(keyframeId);
				System.out.println("converted keyframe "+keyframeId+" to LSC id "+lscID);
			} else {
				//need to convert time into LSCid
				//we use the following mapping: take the videoAtTime, convert into float then muliply it for 4 and round to teh closest even integer
				//then we use the mapping to get the LSCid
				Double time=Double.parseDouble(videoAtTime);
				long middleframe=(long) Math.floor(time*4);
				if (middleframe%2==0) middleframe++;
				String key=videoIdParam+"_mf"+middleframe;
				lscID=MAPPING2LSCID.get(key);
				System.out.println("converted time "+time+" of video "+videoIdParam+" (key "+key+") to LSC id "+lscID);
			}
		}

		boolean exit = false;
		int counter = 0;
		String submittedItem = "";
		//FIXME use dresSubmitLSC 
		while (!exit) {
			try {
				switch (taskType) {
					case "qa":
						response = client.dresSubmitTextAnswer(textAnswer);
						exit = true;
						submittedItem = "text: " + textAnswer;
						break;
					case "avs":
						response = client.dresSubmitLSC(lscID);
						exit = true;
						submittedItem = lscID ;
						break;
					default: // all tasks that are not qa and avs are handled as kis
						response = client.dresSubmitLSC(lscID);
						exit = true;
						submittedItem = lscID;
				}

			} catch (ApiException e) {
				System.err.println("Error with DRES authentication. Trying to init DRES clien again...");
				if (counter++ <= 3)
					client = new DRESClient();
				else {
					System.err.println("Error unable to initialize DRES client");
					exit = true;
				}
			}
		}

		// visioneLog.saveResponse(response);
		System.out.println(Settings.TEAM_ID + "," + submittedItem);

		// saving logs
		try {
			// visioneLog.save(videoId, middleFrame, timeToSubmit,// client.getSessionId(),clientSubmissionTimestamp);
			dresLog.save_submission_log(clientSubmissionTimestamp, client.getSessionId(), MEMBER_ID, submittedItem);
		} catch (IOException | NumberFormatException e1) {
			e1.printStackTrace();
			System.out.println("Failed to save logs of submission:" + Settings.MEMBER_ID + "," + submittedItem);
		}
		return response;
	}
}
