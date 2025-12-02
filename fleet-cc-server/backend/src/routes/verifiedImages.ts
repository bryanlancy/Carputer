import express from 'express'
import { z } from 'zod'
import { ImageVerificationService } from '../services/imageVerification'

const router = express.Router()

// Add verified image schema
const addVerifiedImageSchema = z.object({
	imageBuildHash: z.string().min(1),
	imageSignature: z.string().optional(),
	buildId: z.string().optional(),
	gitSha: z.string().optional(),
	buildTimestamp: z.string().optional(), // ISO date string
	verifiedBy: z.string().optional(),
	notes: z.string().optional(),
})

/**
 * @swagger
 * /api/verified-images:
 *   post:
 *     summary: Add a verified image (Legacy)
 *     description: Adds a carputer image to the verified images list, allowing devices running this image to automatically register. This is a legacy endpoint - use /api/images instead.
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - imageBuildHash
 *             properties:
 *               imageBuildHash:
 *                 type: string
 *               imageSignature:
 *                 type: string
 *               buildId:
 *                 type: string
 *               gitSha:
 *                 type: string
 *               buildTimestamp:
 *                 type: string
 *                 format: date-time
 *               verifiedBy:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Verified image added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 image:
 *                   $ref: '#/components/schemas/Image'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', async (req, res) => {
	try {
		const data = addVerifiedImageSchema.parse(req.body)
		const prisma = req.prisma
		const imageVerification = new ImageVerificationService(prisma)

		await imageVerification.addVerifiedImage(data.imageBuildHash, {
			signature: data.imageSignature,
			buildId: data.buildId,
			gitSha: data.gitSha,
			buildTimestamp: data.buildTimestamp
				? new Date(data.buildTimestamp)
				: undefined,
			verifiedBy: data.verifiedBy || 'admin',
			notes: data.notes,
		})

		const verifiedImage = await imageVerification.getVerifiedImage(
			data.imageBuildHash
		)

		res.status(201).json({
			message: 'Verified image added successfully',
			image: verifiedImage,
		})
	} catch (error) {
		if (error instanceof z.ZodError) {
			return res
				.status(400)
				.json({ error: 'Validation error', details: error.errors })
		}
		console.error('Add verified image error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/verified-images:
 *   get:
 *     summary: Get all verified images (Legacy)
 *     description: Returns all verified images (active and inactive). This is a legacy endpoint - use /api/images instead.
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: activeOnly
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Only return active images
 *     responses:
 *       200:
 *         description: List of verified images
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 images:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Image'
 *                 count:
 *                   type: integer
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', async (req, res) => {
	try {
		const prisma = req.prisma
		const imageVerification = new ImageVerificationService(prisma)
		const activeOnly = req.query.activeOnly !== 'false'

		const images = await imageVerification.getVerifiedImages(activeOnly)

		res.json({
			images,
			count: images.length,
		})
	} catch (error) {
		console.error('Get verified images error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/verified-images/{buildHash}:
 *   get:
 *     summary: Get verified image by build hash (Legacy)
 *     description: Returns a verified image by its build hash. This is a legacy endpoint - use /api/images/{buildHash} instead.
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: buildHash
 *         required: true
 *         schema:
 *           type: string
 *         description: Image build hash
 *     responses:
 *       200:
 *         description: Verified image details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Image'
 *       404:
 *         description: Verified image not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:buildHash', async (req, res) => {
	try {
		const prisma = req.prisma
		const imageVerification = new ImageVerificationService(prisma)
		const { buildHash } = req.params

		const image = await imageVerification.getVerifiedImage(buildHash)

		if (!image) {
			return res.status(404).json({ error: 'Verified image not found' })
		}

		res.json(image)
	} catch (error) {
		console.error('Get verified image error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/verified-images/{buildHash}:
 *   delete:
 *     summary: Deactivate a verified image (Legacy)
 *     description: Deactivates a verified image, preventing new devices from registering with this image. Existing devices are not affected. This is a legacy endpoint - use /api/images/{buildHash} instead.
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: buildHash
 *         required: true
 *         schema:
 *           type: string
 *         description: Image build hash
 *     responses:
 *       200:
 *         description: Verified image deactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 buildHash:
 *                   type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:buildHash', async (req, res) => {
	try {
		const prisma = req.prisma
		const imageVerification = new ImageVerificationService(prisma)
		const { buildHash } = req.params

		await imageVerification.deactivateImage(buildHash)

		res.json({
			message: 'Verified image deactivated successfully',
			buildHash,
		})
	} catch (error) {
		console.error('Deactivate verified image error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

export default router
