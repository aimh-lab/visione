package it.cnr.isti.visione.services;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import javax.ws.rs.client.Client;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.client.Invocation;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import org.apache.commons.io.FileUtils;
import org.apache.commons.io.IOUtils;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.entity.mime.AbstractContentBody;
import org.apache.hc.client5.http.entity.mime.ByteArrayBody;
import org.apache.hc.client5.http.entity.mime.MultipartEntityBuilder;
import org.apache.hc.client5.http.entity.mime.StringBody;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.CloseableHttpResponse;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.HttpEntity;
import org.apache.hc.core5.http.ParseException;
import org.apache.hc.core5.http.io.entity.EntityUtils;

import it.cnr.isti.visione.lucene.LRUCache;

import java.util.Base64;


public class ALADINExtractor {
	
	private static final int THRESHOLD = 100;
	
	private static LRUCache<Integer, String> aladinCache = new LRUCache<>(10);

	public static String text2Features(String textQuery, int k) throws IOException, ParseException {
		long time = -System.currentTimeMillis();
		String aladin = null;
		
		
		synchronized (aladinCache) {
			if (aladinCache.containsKey(textQuery.hashCode())) {
				aladin = aladinCache.get(textQuery.hashCode());
				
				System.out.print(" \t [getting aladin from cache]");
			}
			else {
				try (final CloseableHttpClient httpclient = HttpClients.createDefault()) {
					String encodedQuery = URLEncoder.encode(textQuery, StandardCharsets.UTF_8);
					System.out.println(encodedQuery);
					final HttpGet httpget = new HttpGet(Settings.ALADIN_SERVICE + "?nprobe=1&k=" + k + "&text=" + encodedQuery);

					try (final CloseableHttpResponse response = httpclient.execute(httpget)) {
						final HttpEntity resEntity = response.getEntity();
						if (resEntity != null) {
							aladin = EntityUtils.toString(resEntity);
							if (aladin != null)
								aladin = aladin.replaceAll("\\|", "\\^").replaceAll("\"", "");

						}
					}
				}
				aladinCache.put(textQuery.hashCode(), aladin);
			}	
		}
		
		time += System.currentTimeMillis();
		System.out.println("\t[ALADIN extraction: " + time + "ms]");
		return aladin;

	}

	
	public static String features2Txt(String row) {
		float[] values = stringToFloatArray(row);
		StringBuilder sb = new StringBuilder();
		for (int i = 0; i < values.length; i++) {
			int exp = (int) (values[i] * THRESHOLD);
			if (exp < 0)
				exp = 0;
			for (int rep = 0; rep < exp; rep++) {
				sb.append(i).append(" ");
			}
		}
		return sb.toString().trim();
	}
	
	public static float[] stringToFloatArray(String row) {
		float[] floatarray = null;
		String[] num = row.trim().split(",");
		if (num != null) {
			floatarray = new float[num.length]; 
			for (int i = 0; i <num.length; i++) { 
				floatarray[i] = Float.parseFloat(num[i]);
			} 
		} 
		return floatarray;
	}
	

	public static void main(String[] args) throws IOException, ParseException {
		try (final CloseableHttpClient httpclient = HttpClients.createDefault()) {
			final HttpPost httppost = new HttpPost(Settings.RMAC_SERVICE);

			URL url = new URL(
					"https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/The_Leaning_Tower_of_Pisa_SB.jpeg/197px-The_Leaning_Tower_of_Pisa_SB.jpeg");
//			              URL url = new URL("http://visione.isti.cnr.it/vbsmedia/thumbs/04029/shot04029_96.png.jpg");
//			             HttpsURLConnection connection = (HttpsURLConnection)url.openConnection();
			// InputStream is = con.getInputStream();
			// InputStream is = url.openStream();

			URLConnection connection = url.openConnection();
			InputStream is = connection.getInputStream();

			byte[] targetArray = IOUtils.toByteArray(is);

			final AbstractContentBody bin = new ByteArrayBody(targetArray, ContentType.MULTIPART_FORM_DATA,
					"pippo.jpg");

			final HttpEntity reqEntity = MultipartEntityBuilder.create().addPart("image", bin).build();

			httppost.setEntity(reqEntity);

			System.out.println("executing request " + httppost);
			try (final CloseableHttpResponse response = httpclient.execute(httppost)) {
				System.out.println("----------------------------------------");
				System.out.println(response);
				final HttpEntity resEntity = response.getEntity();
				if (resEntity != null) {
					System.out.println("Response content length: " + resEntity.getContentLength());
				}
				String features = EntityUtils.toString(resEntity);
				EntityUtils.consume(resEntity);
				System.out.println(features);
			}
		}
	}
}
