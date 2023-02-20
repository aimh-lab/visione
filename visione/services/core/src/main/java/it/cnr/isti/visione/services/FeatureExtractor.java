package it.cnr.isti.visione.services;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.net.URLConnection;

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
import org.glassfish.jersey.client.ClientConfig;

import java.util.Base64;


public class FeatureExtractor {
	
	private static final int THRESHOLD = 100;


	public static String url2Features(String imgUrl) throws IOException, ParseException {		
		String features = null;
		byte[] targetArray = null;
		if (imgUrl.startsWith("http")) {
			try (InputStream is =  new URL(imgUrl).openStream()) {
				targetArray = IOUtils.toByteArray(is);
			}
		} else {
			imgUrl = imgUrl.replaceAll("data:image/jpeg;base64,", "");
			targetArray = Base64.getDecoder().decode(imgUrl);
//			FileUtils.writeByteArrayToFile(new File("/home/paolo/Scaricati/test1.jpeg"), targetArray);
//			targetArray = FileUtils.readFileToByteArray(new File("/home/paolo/Scaricati/test2.jpg"));
		}
		if (targetArray != null) {
			try (final CloseableHttpClient httpclient = HttpClients.createDefault()) {
				final HttpPost httppost = new HttpPost(Settings.RMAC_SERVICE);

				final AbstractContentBody bin = new ByteArrayBody(targetArray, ContentType.MULTIPART_FORM_DATA, "pippo.png");

				final HttpEntity reqEntity = MultipartEntityBuilder.create().addPart("image", bin).build();

				httppost.setEntity(reqEntity);

				try (final CloseableHttpResponse response = httpclient.execute(httppost)) {
					final HttpEntity resEntity = response.getEntity();
					if (resEntity != null) {
						String rmac = EntityUtils.toString(resEntity);

//						rmac = rmac.trim().substring(1, rmac.length()-2);
//						System.out.println(rmac);
//						features = preprocessed(rmac);
//						System.out.println(features);

						features = rmac.replaceAll("\\[", "").replaceAll("\\]", "");
						System.out.println(features);

						features = rmac2Txt(features);
						System.out.println(features);
					}
				}
			}
		}
		return features;
	}
	
	public static String url2FeaturesUrl(String imgUrl) throws IOException, ParseException {
		String features = null;
			try (final CloseableHttpClient httpclient = HttpClients.createDefault()) {
				final HttpGet httpget = new HttpGet(Settings.RMAC_SERVICE + "?url=" + imgUrl);

				try (final CloseableHttpResponse response = httpclient.execute(httpget)) {
					final HttpEntity resEntity = response.getEntity();
					if (resEntity != null) {
						String rmac = EntityUtils.toString(resEntity);
						//String rmac = EntityUtils.toString(resEntity).replaceAll("\"", "");
//						System.out.println(rmac);

//						rmac = rmac.substring(1, rmac.length()-2);
//						System.out.println(rmac);
//						features = preprocessed(rmac);
//						System.out.println(features);

						features = rmac2Txt(rmac);
					}
				}
			}
		return features;

	}
	
	public static String rmac2Txt(String row) {
		return row.trim().replaceAll("\\|", "\\^").replaceAll("\"", "");
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
