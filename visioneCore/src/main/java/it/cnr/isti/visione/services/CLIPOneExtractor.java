package it.cnr.isti.visione.services;

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.apache.commons.io.IOUtils;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.entity.mime.AbstractContentBody;
import org.apache.hc.client5.http.entity.mime.ByteArrayBody;
import org.apache.hc.client5.http.entity.mime.MultipartEntityBuilder;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.CloseableHttpResponse;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.HttpEntity;
import org.apache.hc.core5.http.ParseException;
import org.apache.hc.core5.http.io.entity.EntityUtils;

import com.google.gson.Gson;

import it.cnr.isti.visione.lucene.Fields;


public class CLIPOneExtractor {
	
	private static Gson gson = new Gson();
	private static final int V3C1_END = 7475;
	
	
	private static Map<String, String> extractors = Stream.of(new String[][] {
		  { "v3c", Settings.CLIP_ONE_SERVICE }, 
		  { "v3c1", Settings.CLIP_ONE_SERVICE }, 
		  { "v3c2", Settings.CLIP_ONE_SERVICE }, 
		  { "mvk", Settings.CLIP_ONE_SERVICE_MVK }, 
		}).collect(Collectors.toMap(data -> data[0], data -> data[1]));
	
	private static Map<String, String> internalExtractors = Stream.of(new String[][] {
		  { "v3c", Settings.CLIP_ONE_INTERNAL_IMG_SEARCH_SERVICE }, 
		  { "v3c1", Settings.CLIP_ONE_INTERNAL_IMG_SEARCH_SERVICE }, 
		  { "v3c2", Settings.CLIP_ONE_INTERNAL_IMG_SEARCH_SERVICE }, 
		  { "mvk", Settings.CLIP_ONE_INTERNAL_IMG_SEARCH_SERVICE_MVK }, 
		}).collect(Collectors.toMap(data -> data[0], data -> data[1]));

	public static SearchResults[] text2VisioneResults(String textQuery) throws IOException, ParseException {
		SearchResults[] results = null;
			try (final CloseableHttpClient httpclient = HttpClients.createDefault()) {
				String encodedQuery = URLEncoder.encode(textQuery, StandardCharsets.UTF_8);
				System.out.println(encodedQuery);
				final HttpGet httpget = new HttpGet(Settings.CLIP_SERVICE + "?text=" + encodedQuery + "&k=" + Settings.K);

				try (final CloseableHttpResponse response = httpclient.execute(httpget)) {
					final HttpEntity resEntity = response.getEntity();
					if (resEntity != null) {
						String res = EntityUtils.toString(resEntity);
						results = gson.fromJson(res, SearchResults[].class);
						for (int i = 0; i < results.length; i++) {
							String videoId = results[i].imgId.split("_")[0];
							if (Integer.parseInt(videoId) > V3C1_END)
								results[i].collection = "v3c2";
							else
								results[i].collection = "v3c1";
							results[i].imgId = videoId + "/" + results[i].imgId;
						}
//						System.out.println(res);
					}
				}
			}
			
		return results;

	}
	
	public static SearchResults[] text2CLIPResults(String textQuery, String collection) throws IOException, ParseException {
		SearchResults[] results = null;
			try (final CloseableHttpClient httpclient = HttpClients.createDefault()) {
				String encodedQuery = URLEncoder.encode(textQuery, StandardCharsets.UTF_8);
				System.out.println(encodedQuery);
				final HttpGet httpget = new HttpGet(extractors.get(collection) + "?text=" + encodedQuery + "&k=" + Settings.K);

				try (final CloseableHttpResponse response = httpclient.execute(httpget)) {
					final HttpEntity resEntity = response.getEntity();
					if (resEntity != null) {
						String res = EntityUtils.toString(resEntity);
						results = gson.fromJson(res, SearchResults[].class);
					}
				}
			}
			
		return results;

	}
	
	public static SearchResults[] id2CLIPResults(String queryID, String collection) throws IOException, ParseException {
		SearchResults[] results = null;
			try (final CloseableHttpClient httpclient = HttpClients.createDefault()) {
				//temporary for mvk
				String encodedQuery = URLEncoder.encode(queryID, StandardCharsets.UTF_8);
				if (queryID.lastIndexOf("/") > 0)
					encodedQuery = URLEncoder.encode(queryID.split("/")[1], StandardCharsets.UTF_8);
				System.out.println(encodedQuery);
				
				final HttpGet httpget = new HttpGet(internalExtractors.get(collection) + "?imgId=" + encodedQuery + "&k=1000");

				try (final CloseableHttpResponse response = httpclient.execute(httpget)) {
					final HttpEntity resEntity = response.getEntity();
					if (resEntity != null) {
						String res = EntityUtils.toString(resEntity);
						results = gson.fromJson(res, SearchResults[].class);
					}
				}
			}
			
		return results;

	}
	

	public static void main(String[] args) throws IOException, ParseException {
		String textQuery = "a bike is near a dog";
		
		String res = null;
		try (final CloseableHttpClient httpclient = HttpClients.createDefault()) {
			String encodedQuery = URLEncoder.encode(textQuery, StandardCharsets.UTF_8);
			System.out.println(encodedQuery);
			final HttpGet httpget = new HttpGet("http://mb-messina.isti.cnr.it:5010/text-to-image-search?text=" + encodedQuery + "&k=" + 10);

			try (final CloseableHttpResponse response = httpclient.execute(httpget)) {
				final HttpEntity resEntity = response.getEntity();
				if (resEntity != null) {
					res = EntityUtils.toString(resEntity);
					System.out.println(res);
					SearchResults[] results = gson.fromJson(res, SearchResults[].class);
					for (int i = 0; i < results.length; i++) {
						String videoId = results[i].imgId.split("_")[0];
						if (Integer.parseInt(videoId) > V3C1_END)
							results[i].collection = "v3c2";
						else
							results[i].collection = "v3c1";
						results[i].imgId = videoId + "/" + results[i].imgId;
					}
					System.out.println(results);
				}
			}
		}
	}

	public static String getObjectTxt4CLIP(String instring) {
		HashSet<String> ignore=new HashSet<String>();	
		ignore.addAll( Arrays.asList("black","blue","brown", "green", "grey","orange", "pink", "purple", "red", "white", "yellow", "*"));
		instring=instring.replaceAll("\\s+","");
		String res="";
		if(instring.contains("4wcgraykeyframe")) {
			res+=", the video shot is in black and white tones";
			instring=instring.replaceAll("4wcgraykeyframe", "");
		}else {
			if(instring.contains("4wccolorkeyframe")) {
				instring=instring.replaceAll("4wccolorkeyframe", "");
			}
		}

		instring=instring.replaceAll("-4wc", "4wc-");
		//		string=string.replaceAll("4wc", "");
		String[] splitObj=instring.split("4wc");


		String contain="";
		String containAtMost="";
		HashMap<String,Integer> hm_contains=new HashMap<String,Integer>();
		HashMap<String,Integer> hm_containsAtMost=new HashMap<String,Integer>();
		for(String obj: splitObj) {
			obj=obj.replaceAll("\\s+","");
			if(obj.isBlank() || ignore.contains(obj))
				continue;
			if(obj.startsWith("-")) {
				//max objects
				obj=obj.replaceAll("-", "");
				String label=obj.replaceAll("[^A-Za-z]", "");
				Integer occurrence=Integer.parseInt(obj.replaceAll("[^0-9]", "")) - 1;
				if(occurrence>0) {
					int atmost=hm_containsAtMost.getOrDefault(label, Integer.MAX_VALUE);
					occurrence=Math.min(atmost, occurrence);
					hm_containsAtMost.put(label, occurrence);
				}

			}else {
				Integer occurrence=Integer.parseInt(obj.replaceAll("[^0-9]", ""));
				String label=obj.replaceAll("[^A-Za-z]", "");
				int atmost=hm_contains.getOrDefault(label, 0);
				occurrence=Math.max(atmost, occurrence);
				hm_contains.put(label, occurrence);
			}
		}

		
		boolean first = true;
		if(hm_contains.size()>0) {
			res+=", The image contains ";
			first = true;
			for(String label:hm_contains.keySet()) {
				int occurrence= hm_contains.get(label);
				 if (first) {
					 res+=occurrence+" "+ label;
					 first = false;
				 }
				 else
					 res+=", "+occurrence+" "+ label;
			}

			if(hm_containsAtMost.size()>0) {
				res+=", and ";
				first = true;
				for(String label:hm_containsAtMost.keySet()) {
					int occurrence= hm_containsAtMost.get(label);
					 if (first) {
						 res+="at most "+occurrence+" "+ label;
						 first = false;
					 }
					 else
						 res+=", "+"at most "+occurrence+" "+ label;
				}
			}	
		}else {
			if(hm_containsAtMost.size()>0) {
				res+=", The image contains at most ";
				first = true;
				for(String label:hm_contains.keySet()) {
					int occurrence= hm_contains.get(label);
					 if (first) {
						 res+="at most "+occurrence+" "+ label;
						 first = false;
					 }
					 else
						 res+=", "+"at most "+occurrence+" "+ label;
				}
			}

		}

		return res;
	}
}
