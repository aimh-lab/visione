package it.cnr.isti.visione.services;

import java.io.IOException;
import java.util.Base64;

import org.apache.hc.client5.http.entity.mime.MultipartEntityBuilder;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.core5.http.ClassicHttpRequest;
import org.apache.hc.core5.http.ClassicHttpResponse;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.HttpEntity;
import org.apache.hc.core5.http.HttpStatus;
import org.apache.hc.core5.http.ParseException;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.apache.hc.core5.http.io.support.ClassicRequestBuilder;

import com.google.gson.Gson;

public class FeatureExtractor {

	private Gson gson = new Gson();

	public String featureName;
	public String extractorEndpoint;

	public FeatureExtractor(String featureName) {
		this.featureName = featureName;
		this.extractorEndpoint = "http://features-" + featureName.toLowerCase() + ":8080";
	}

	public FeatureExtractor(String featureName, String extractorEndpoint) {
		this.featureName = featureName;
		this.extractorEndpoint = extractorEndpoint;
	}

	private Float[] parseResponse(ClassicHttpResponse response) throws IOException, ParseException {
		int statusCode = response.getCode();
		String responseBody = EntityUtils.toString(response.getEntity());
		if (statusCode == HttpStatus.SC_OK) {
			return gson.fromJson(responseBody, Float[].class);
		} else {
			System.err.println("HTTP error occurred. Status code: " + statusCode);
			System.err.println("Response body: " + responseBody);
			return null;
		}
	}

	public Float[] extractFromUrl(String url) {
		try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
			ClassicHttpRequest request = ClassicRequestBuilder
					.get(extractorEndpoint + "/get-image-feature")
					.addParameter("url", url)
					.build();
			System.out.println(request);

			ClassicHttpResponse response = httpClient.execute(request);
			return parseResponse(response);
		} catch (IOException | ParseException e) {
			e.printStackTrace();
			return null;
		}
	}

	public Float[] extractFromImage(String b64Image) {
		// send a base 64 image (e.g., data:image/jpeg;base64,..) to the extractor as
		// file upload (multipart form data)
		// parse base64 string
		String[] b64ImageParts = b64Image.split(",");
		String imageHeader = b64ImageParts[0]; // e.g., data:image/jpeg;base64
		String contentType = imageHeader.split(";")[0].split(":")[1]; // e.g., image/jpeg
		String extension = contentType.split("/")[1]; // e.g., jpeg
		String imageData = b64ImageParts[1];
		byte[] imageBytes = Base64.getDecoder().decode(imageData);

		try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
			HttpEntity imageEntity = MultipartEntityBuilder
					.create()
					.addBinaryBody("image", imageBytes, ContentType.create(contentType), "image." + extension)
					.build();
			ClassicHttpRequest request = ClassicRequestBuilder
					.post(extractorEndpoint + "/get-image-feature")
					.setEntity(imageEntity)
					.build();
			System.out.println(request);

			ClassicHttpResponse response = httpClient.execute(request);
			return parseResponse(response);
		} catch (IOException | ParseException e) {
			e.printStackTrace();
			return null;
		}
	}
}